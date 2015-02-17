var Promise = require('bluebird');
var request = Promise.promisify(require('request'));
var sentimentController = Promise.promisifyAll(require('../sentiment/sentimentController'));
var config = require('config');
var _apiKey = config.get('nltk');
var spellCheckerController = Promise.promisifyAll(require('./spellCheckerController'));

var nltkController = {};
nltkController.getSentimentsSync = getSentimentsSync;

function getSentimentsSync(comment) {
  var text = comment.text;
  return spellCheckerController.correctSentence(text)
    .then(function(correctSentence) {
      var options = {
        uri: "https://japerk-text-processing.p.mashape.com/sentiment/",
        method: "POST",
        headers: {
          "X-Mashape-Key" : _apiKey,
          "Content-Type" : "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        form: {"language": "english", "text" : correctSentence}
      };

      return request(options)
        .spread(function (response, body) {
          return sentimentController.addSentiment(createSentimentForDB(JSON.parse(body), comment));
        })

    })
    .then(null, function(err) {
      console.log('error with nltk request', err);
    });

}

function createSentimentForDB(sentiment, comment) {
  sentiment = sentiment.probability;
  var sentimentObj = {};
  sentimentObj.positive = sentiment.pos;
  sentimentObj.neutral = sentiment.neutral;
  sentimentObj.title = comment.title;
  sentimentObj.id = comment.id;
  sentimentObj.time = comment.time;
  console.log('sentiment', sentimentObj);
  return sentimentObj;
}

module.exports = nltkController;