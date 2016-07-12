    /*** DB Model ***/

    var Answer = require('./answer.model')

    /*** TDD ***/

	var sinon = require('sinon');
	var chai = require('chai');
	var expect = chai.expect;
    var mongoose = require('mongoose');

	require('sinon-mongoose');

    describe("Post a new answer", () => {

    	var answerData = { answerText: 'Save new answer from mock', questionType: 'Improve Product', userName: 'User Name'};

        it("should create new post", (done) => {
            var AnswerMock = sinon.mock(new Answer(answerData));
            var answer = AnswerMock.object;
            var expectedResult = { status: true };
            AnswerMock.expects('save').yields(null, expectedResult);
            answer.save((err, result) => {
                AnswerMock.verify();
                AnswerMock.restore();
                expect(result.status).to.be.true;
                done();
            });
        });

        it("should return error, if post not saved", (done) => {
            var AnswerMock = sinon.mock(new Answer(answerData));
            var answer = AnswerMock.object;
            var expectedResult = { status: false };
            AnswerMock.expects('save').yields(expectedResult, null);
            answer.save((err, result) => {
                AnswerMock.verify();
                AnswerMock.restore();
                expect(err.status).to.not.be.true;
                done();
            });
        });
    });
	