"use latest"
/***
*	
*	Auth0 Job Application 
*	MiguelSanSegundo@gmail.com
*	
*	LATEST POPULAR POSTS UNANSWERED
*	Why are there forum posts with many times read or with many likes 
*	but nobody answers? Let's know which are those posts! 
*	This webtask uses a SDK API from the Auth0 forum to find  
* 	the latest unanswered posts ordered by likes & views.
*	Then persists these posts in MongoDB and return them. 
*/

let mongoose = require('mongoose')
let request = require('request')
let Rx = require('rx')

module.exports = function runTask(ctx, done) {

	let mongoDBObservable = new Rx.Subject()
	let requestPostsObservable = new Rx.Subject()
	let db = connectMongoDB(ctx.data, mongoDBObservable)

	mongoDBSubscriber(mongoDBObservable, requestPostsObservable, done)
	requestPostsSubscriber(requestPostsObservable, db, done)
}

////////*\\\\\\\\

function connectMongoDB(secrets, observable) {
	
	let options = { server: { socketOptions: { keepAlive: 1000, connectTimeoutMS: 30000 } }, 
                	replset: { socketOptions: { keepAlive: 1000, connectTimeoutMS : 30000 } } }       
	let mongodbUri = secrets.MONGO_URI

	mongoose.connect(mongodbUri, options)
	let db = mongoose.connection

	db.on('error', console.error.bind(console, 'Mongoose connection error!'))
	db.once('open', () => {
		observable.onNext()
		console.log('Mongoose connection openned!', secrets.MONGO_URI)
	})

	return db
}

function mongoDBSubscriber(observable, requestPostsObservable, done) {
	observable.subscribe(
		(data) => {
			requestPosts((err, posts) => {
				if (err) {
					done(err)
					console.log(err)
					return
				}

				requestPostsObservable.onNext(posts)
			})
		},
	    (err) => {
	        console.log('The observable has catched an error!', err)
	    }
    )
}

function requestPostsSubscriber(observable, db, done) {

	observable.subscribe(
		(posts) => {
			savePosts(posts, (err, result) => {
				db.close()
				console.log('Mongoose connection closed!')
				if (err) {
					console.error(err)
					done(err)
					return
				}
				done(null, result)
			})
		},
	    (err) => {
	        console.log('The observable has catched an error!', err)
	    }
    )
}

function requestPosts(cb) {

	let latestJsonSDK = 'https://auth0.com/forum/c/sdks/l/latest.json?_=' + new Date().getTime()
	request(latestJsonSDK, (err, response, body) => {
		
		if (err) {
			console.error("The request to latest.json SDK failed!", err)
			return cb(err)
		}
		if (response.statusCode == 200) {
			let posts = parsePosts(body, cb)
			posts = sortFilterPost(posts)
			cb(null, posts) 
		}
	})

	////////*\\\\\\\\
	function parsePosts(body, cb) {

		let bodyParsed
		try {
			bodyParsed = JSON.parse(body)
		} catch (err) {
			return cb({ error: err, message: 'The latest.json SDK response is not a valid JSON!' }) 
		}

		let posts = bodyParsed 
					&& bodyParsed.topic_list 
					&& bodyParsed.topic_list.topics
		if (posts === undefined) {
			return cb({ message: 'The latest.json SDK response has undefined topic_list.topics!' }) 
		}
		return posts
	}

	function sortFilterPost(posts) {
		
		return posts.filter(function unanwered(post) {
					return (post.reply_count === 0 && post.posts_count === 1)
				})
				.sort(function likesAndViewsAscending(a, b) {
				  	let x = b.like_count - a.like_count
					return x == 0 ? b.views - a.views : x
				})
				.map(function miniModel(post) {
					return {
						created_at: post.created_at,
						id: post.id,
						title: post.title,
						link: `https://auth0.com/forum/t/${post.slug}/${post.id}`
					}
				})
	}	
}

function createPostsModel() {

	let Schema = mongoose.Schema
	let postsSchema = Schema({
		posts: {
			type: []
		},
		createdTime: {
			type: Date,
			default: Date.now
		}
	})

	var postsModel = mongoose.model('Post', postsSchema)	

	return (posts) => { return new postsModel({posts: posts}) }
}

function savePosts(posts, cb) {
	let postsModel = createPostsModel()(posts) 
	postsModel.save(function(err, result){
		if (err) {
			console.error("Something went wrong!", err)
			cb(err)
			return
		}
		cb(null, { description: 'Latest Popular Posts Unanswered', posts: result, message: 'Posts saved in MongoDB!' })
    })
}
