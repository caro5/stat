var sentimentController = require('../sentiment/sentimentController');
var aggregatorController = {};
aggregatorController.aggregate = aggregate;


function aggregate(req,res) {
  var storage = {};
  var avgRating = 0;
  var term = req.params.term;
  console.log('aggregate called');
  sentimentController.getSentimentsFromKeyword(term, function(err, total) {
    console.log(total);
    if (total.length === 0) {
      res.send([]);
    }

    total.forEach(function(obj) {
      var objId = JSON.stringify(obj.id);
      var sentiment = obj.sentiment;
      var valObj = {};
      avgRating += obj['score'];
      if (!storage[sentiment]) {
        valObj.count = 1;
        valObj.id = objId;
        valObj.score = obj.score;
        storage[sentiment] = valObj;
      } else {
        storage[sentiment].count++;
      }
    });
    var origStore = storage;
    var topVals = sortObjectByCount(storage);

    // var topScores = sortObjectByScore(storage);
    // console.log('storage', topScores);
    // console.log('topval', storage[topScores[0].key].id, term);
    // TO DO, if not sentiments, then do not use topVals[0].key
    if (topVals.length > 0) {
      //get top comment
      sentimentController.getCommentFromSentimentID(storage[topVals[0].key].id, function(err, foundSentiment) {
        // console.log('foundsent', foundSentiment);
        comment = foundSentiment.comment;
        var returnResult = {};
        returnResult.topic = term;
        returnResult.avg = avgRating/total.length;
        returnResult.topValues = topVals;
        returnResult.topComment = comment;
        // console.log('return res',returnResult);
        //clearCache
        storage = {};
        avgRating = 0;

        var posArr = [];
        var negArr = [];
        // console.log('st', origStore);

        var topScores = sortObjectByScore(origStore);
        // console.log('storage', topScores);
        // console.log('topval22', topScores[0].value.id, term);

        var posNegCount = 4;
        var posId = [topScores[0].value.id,topScores[1].value.id];
        var negId = [topScores[topScores.length - 1].value.id,topScores[topScores.length - 2].value.id];
        var posArr = [];
        var negArr = [];

        sentimentController.getCommentFromSentimentID(posId[0], function(err, foundSentiment) {
          posArr.push(foundSentiment.comment);
          sentimentController.getCommentFromSentimentID(posId[1], function(err, foundSentiment2) {
              posArr.push(foundSentiment2.comment);
            sentimentController.getCommentFromSentimentID(negId[0], function(err, foundSentiment3) {
              negArr.push(foundSentiment3.comment);
              sentimentController.getCommentFromSentimentID(negId[1], function(err, foundSentiment4) {
                negArr.push(foundSentiment4.comment);

                returnResult.posComments = posArr;
                returnResult.negComments = negArr;
                console.log(returnResult);
                res.send(returnResult);
              });
            });
          });
        });

      });
      //get pos comments
      // var posNegCount = 4;
      // var posId = [topScores[0].value.id,topScores[1].value.id];
      // var negId = [topScores[topScores.length - 1].value.id,topScores[topScores.length - 2].value.id];
      // var posArr = [];
      // var negArr = [];
      // // console.log('qwer',posId, negId);

      // while (posNegCount > 2) {
      //   var theId = posId.shift();
      //   console.log('postnegid', JSON.stringify(theId));
      //   sentimentController.getCommentFromSentimentID(theId, function(err, foundSentiment) {
      //     console.log('foundsent', foundSentiment.comment);
      //   var comment = foundSentiment.comment;
      //     posArr.push(comment);
      //     posNegCount--;
      //   });
      // }

      // while (posNegCount > 0) {
      //   var neg = negId.shift();
      //   sentimentController.getCommentFromSentimentID(neg, function(err, foundSentiment) {
      //     console.log('foundsent', foundSentiment.comment);
      //   var comment = foundSentiment.comment;
      //     negArr.push(comment);
      //     posNegCount--;
      //     if (posNegCount === 0) {
      //       res.send(returnResult);
      //     }
      //   });
      // }
    }


  });
};


function sortObjectByCount(obj) {
  var arr = [];
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      console.log('prop', prop);
      arr.push({
        'key': prop,
        'value': obj[prop]
      });
    }
  }
  arr.sort(function(a, b) {
    return b.value.count - a.value.count;
  });
  // console.log('arrCount', arr);
  return arr;
}
function sortObjectByScore(obj) {
  var arr = [];
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      console.log('prop', prop);
      arr.push({
        'key': prop,
        'value': obj[prop]
      });
    }
  }
  arr.sort(function(a, b) {
    return b.value.score - a.value.score;
  });
  // console.log('arrScore', arr);
  return arr;
}

module.exports = aggregatorController;