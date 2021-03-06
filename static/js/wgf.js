/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var wgf = wgf || {};
wgf.card = wgf.card || {};

(function() {
  // Wrap XMLHttpRequest in a Promise.
  // www.html5rocks.com/en/tutorials/es6/promises/
  var get = function (url) {
    return new Promise(function (resolve, reject) {
      var req = new XMLHttpRequest()
      req.open('GET', url)

      req.onload = function () {
        // This is called even on 404, etc.
        // so check the status.
        if (req.status == 200) {
          resolve(req.response)
        } else {
          // Otherwise reject with the status text
          // which will hopefully be a meaningful error.
          reject(Error(req.statusText))
        }
      }

      // Handle network errors.
      req.onerror = function () {
        reject(Error('Network Error'))
      }

      // Make the request.
      req.send();
    })
  }

  wgf.loadPreferredLanguage = function () {
    var deckJSON = localStorage.getItem('deck')
    if (!!deckJSON) {
      var loadedDeck = JSON.parse(deckJSON)
      return loadedDeck['preferredLanguage']
    }
    return 'en'
  }

  wgf.listCards = function (options) {
    if (options['rootPath'] === undefined) {
      throw new Error('rootPath to API must be defined')
    }
    if (options['preferredLanguage'] === undefined) {
      throw new Error('preferredLanguage must be defined')
    }
    return get(options['rootPath'] + '/api/v1/cards.json')
      .then(JSON.parse)
      .then(function (cards) {
        // Choose the most appropriate card URLs for the deck.
        var preferredLanguage = options['preferredLanguage']
        deck = {
          'preferredLanguage': preferredLanguage,
          'cards': {},
          'cardLanguages': {}
        }
        for (var cid in cards) {
          var card = cards[cid]
          deck['cards'][cid] = {}
          // All cards must have at least an English translation.
          // TODO: Choose a better fallback language based on the browser
          //       language preferences.
          var cardLanguage = 'en'
          if (preferredLanguage in card) {
            cardLanguage = preferredLanguage
          }
          deck['cards'][cid] = card[cardLanguage]['url']
          deck['cardLanguages'][cid] = cardLanguage
        }
        return deck
      })
  }

  wgf.getDeck = function (deck) {
    // Deck starts at -1 because we display the title card first, which actually
    // doesn't appear in the cards list.
    deck['topCard'] = -1
    deck['deck'] = []

    for (var cid in deck['cards']) {
      deck['deck'].push(cid)
    }

    var deckJSON = localStorage.getItem('deck')

    if (!!deckJSON) {
      var loadedDeck = JSON.parse(deckJSON)
      deck['topCard'] = loadedDeck['topCard']
      deck['deck'] = []

      var allCards = {}

      for (var cid in deck['cards']) {
        allCards[cid] = true
      }

      var i = 0

      while (loadedDeck['deck'].length > 0) {
        var cid = loadedDeck['deck'].splice(0, 1)[0]

        if (cid in allCards) {
          deck['deck'].push(cid)
          delete allCards[cid]
        } else {
          // Card was deleted. Shift it out of the deck.
          // If we are deleting a card that has already been shown (including)
          // the current one being displayed, shift where we think the top card
          // is so that we don't skip any that haven't been shown, yet.
          if (i <= deck['topCard']) {
            deck['topCard'] = deck['topCard'] - 1
            i = i - 1
          }
        }
        i = i + 1;
      }

      // These are the new cards that we missed.
      for (var cid in allCards) {
        deck['deck'].push(cid)
      }
    }

    shuffle(deck['deck'], deck['topCard'] + 1)

    // Save the deck now that it has the preferredLanguage
    // and all the new cards.
    localStorage.setItem('deck', JSON.stringify(deck))
    return deck
  }

  wgf.getTopCardURL = function (deck) {
    var cardID = deck['topCard']
    var url = ''

    if (cardID < 0) {
      url = '/' + deck['preferredLanguage'] + '/'
    } else {
      var currentCard = deck['deck'][cardID]
      // TODO: Use relative URLs so this works in other directories.
      url = deck['cards'][currentCard]

      if (deck['cardLanguages'][currentCard] !== deck['preferredLanguage']) {
        url = url + '#!/?lang=' + deck['preferredLanguage']
      }
    }

    return url
  }

  wgf.navigateNextCard = function (deck) {
    deck['topCard'] = deck['topCard'] + 1

    if (deck['topCard'] >= deck['deck'].length) {
      deck['topCard'] = -1
      shuffle(deck['deck'])
    }

    localStorage.setItem('deck', JSON.stringify(deck))
    window.location = wgf.getTopCardURL(deck)
  }

  wgf.attachNextCard = function (deck) {
    var nextButton = document.getElementById('wgf-next-button-link')
    nextButton.addEventListener('click', function (event) {
      event.preventDefault()
      wgf.navigateNextCard(deck)
    })
  }

  // Shuffle the array from opt_left to the end of the array.
  // http://stackoverflow.com/a/6274398
  var shuffle = function(array, opt_left) {
    opt_left = opt_left || 0;
    var counter = array.length;

    // While there are elements in the array
    while (counter > opt_left) {
      // Pick a random index
      var index = Math.floor(Math.random() * (counter - opt_left))
      index = index + opt_left;

      // Decrease counter by 1
      counter--;

      // And swap the last element with it
      var temp = array[counter];
      array[counter] = array[index];
      array[index] = temp;
    }

    return array;
  }

  // We export as a node module for automated testing.
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = wgf.card;
  }
})();
