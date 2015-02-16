var Promise = require('bluebird');
var _ = require('lodash');

var commentController = Promise.promisifyAll(require('../server/comment/commentController'));
var storyController = Promise.promisifyAll(require('../server/story/storyController'));

var nltkController = Promise.promisifyAll(require('../server/util/nltkController'));
var sentimentController = require('../server/sentiment/sentimentController');
var config = require('config');
var request = Promise.promisify(require('request'));

var mongoose = require('mongoose');
mongoose.connect(config.get('mongo'));

var numberToScrape = 50;

function populateDBWithStories() {
  var temp = request('https://hacker-news.firebaseio.com/v0/topstories.json')
    .spread(function(response, body) {
      var topID = JSON.parse(body)[99];

      return topID;
    });

  var promiseArray = [];
  promiseArray.push(temp);
  promiseArray.push(commentController.getAllCommentIds());
  promiseArray.push(storyController.getAllStoryIds());

  Promise.all(promiseArray)
    .then(function(results) {
      console.log('step 1');
      var higher = results[0];
      var commentIds = results[1];
      var storyIds = results[2];

      var requestsForStories = [];
      for (var i = higher - numberToScrape; i < higher; i++) {
        if (commentIds.indexOf(i) < 0 && storyIds.indexOf(i) < 0) {
          var temp = request('https://hacker-news.firebaseio.com/v0/item/' +i +'.json')
            .spread(function(response, body) {
              return JSON.parse(body);
            });
          requestsForStories.push(temp);
        }
      }

      return Promise.all(requestsForStories);
    })
    // finds stories from hacker news items
    .then(function(hackerNewsItems) {
      console.log('step 2');
      var stories = [];
      for (var i = 0; i < hackerNewsItems.length; i++) {
        var item = hackerNewsItems[i];
        if (item && item.type === 'story') {
          stories.push(storyController.addStory(createStoryForDB(item)));
        }
      }

      return Promise.all(stories);
    })
    // get comments from stories
    .then(function(stories) {
      var commentRequests = [];
      var count = 0;
      function createComment(commentId, title) {
        return request('https://hacker-news.firebaseio.com/v0/item/' +commentId +'.json')
          .spread(function(response, body) {
            if (JSON.parse(body)) {
              var comment = createCommentForDB(JSON.parse(body), title);
              var tempArray = [];
              tempArray.push(commentController.addComment(comment));

              for (var i = 0; i < comment.kids.length; i++) {
                tempArray.push(createComment(comment.kids[i], title));
              }
              return Promise.all(tempArray);
            }
          })
          .catch(function(err) {
            console.log('error with creating commment', err);
          });
      }

      for (var i = 0; i < stories.length; i++) {
        for (var j = 0; j < stories[i].kids.length; j++) {
          commentRequests.push(createComment(stories[i].kids[j], stories[i].title));
        }
      }

      return Promise.all(commentRequests);
    })
    .then(function(comments) {
      console.log('getting sentiments from comments');
      comments = _.flattenDeep(comments);

      var sentimentsFromComments = [];
      for (var i = 0; i < comments.length; i++) {
        if (comments[i] && comments[i].text) {
          sentimentsFromComments.push(nltkController.getSentimentsSync(comments[i]));
        }
      }

      return Promise.all(sentimentsFromComments);
    })
    .then(function(sentiments) {
       console.log('running thorugh sentiments');

      for (var i = 0; i < sentiments.length; i++) {
        sentimentController.addSentiment(sentiments[i]);
      }

      console.log('done');
    })
    .then(null, function(err) {
      console.log('error getting new comments', err);
    });
}

function createStoryForDB(storyFromAPI) {
  var story = {};
  story.storyId = storyFromAPI.id;
  story.title = storyFromAPI.title;
  story.kids = storyFromAPI.kids || [];
  story.time = storyFromAPI.time;
  story.by = storyFromAPI.by;
  story.score = storyFromAPI.score;

  return story;
}

function createCommentForDB(commentFromAPI, title) {
  var comment = {};
  comment.commentId = commentFromAPI.id;
  comment.kids = commentFromAPI.kids || [];
  comment.text = commentFromAPI.text;
  comment.by = commentFromAPI.by;
  comment.time = commentFromAPI.time;
  comment.title = title;

  return comment;
}

populateDBWithStories();
