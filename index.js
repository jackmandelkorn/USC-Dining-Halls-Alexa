const SKILL_NAME = "USC Dining Halls"
const HELP_MESSAGE = "You can ask me about USC dining halls, or exit... What can I do for you?"
const HELP_REPROMPT = "What can I do for you?"
const STOP_MESSAGE = "Goodbye!"
const FATAL_ERROR_MESSAGE = "Sorry, I'm not sure."
const NO_RESULTS_MESSAGE = "Sorry, I'm not sure."

const LOCATION_ALIASES = {
  "usc village dining hall": "mccarthy",
  "parkside restaurant  grill": "parkside",
  "everybodys kitchen": "evk"
}

const Alexa = require("ask-sdk-core")
const request = require("request")
const jsdom = require("jsdom")
const { JSDOM } = jsdom
const { document } = (new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>")).window

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest")
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak(HELP_REPROMPT).reprompt(HELP_REPROMPT).getResponse()
  }
}

const GetIntentHandler = {
  canHandle(handlerInput) {
    return (Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" && Alexa.getIntentName(handlerInput.requestEnvelope) === "Get")
  },
  async handle(handlerInput) {
    let slots = handlerInput.requestEnvelope.request.intent.slots
    let diningHall = slots.DiningHall.resolutions.resolutionsPerAuthority[0].values[0].value
    let meal = slots.Meal.resolutions.resolutionsPerAuthority[0].values[0].value
    let output = NO_RESULTS_MESSAGE
    let json = parseMenuJSON(await obtainHTML())
    try {
      let parent = json[meal.id]
      if ((parent === undefined) && meal.id === "lunch") {
        parent = json["brunch"]
        meal.name = "Brunch"
      }
      else if (meal.id === "lunch") {
        meal.name = "Lunch"
      }
      let arr = parent[diningHall.id]
      let last = arr.pop()
      output = ("For " + meal.name.toLowerCase() + ", " + diningHall.name + " is serving " + arr.join(", ") + ", and " + last + ".")
    }
    catch (error) {
      console.log(`~~~~ Error handled: ${JSON.stringify(error)}`)
    }
    return handlerInput.responseBuilder.speak(output).getResponse()
  }
}

const VerifyIntentHandler = {
  canHandle(handlerInput) {
    return (Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" && Alexa.getIntentName(handlerInput.requestEnvelope) === "Verify")
  },
  async handle(handlerInput) {
    let slots = handlerInput.requestEnvelope.request.intent.slots
    let diningHall = slots.DiningHall.resolutions.resolutionsPerAuthority[0].values[0].value
    let meal = slots.Meal.resolutions.resolutionsPerAuthority[0].values[0].value
    let food = slots.Food.value
    let output = NO_RESULTS_MESSAGE
    let json = parseMenuJSON(await obtainHTML())
    try {
      let parent = json[meal.id]
      if ((parent === undefined) && meal.id === "lunch") {
        parent = json["brunch"]
        meal.name = "Brunch"
      }
      else if (meal.id === "lunch") {
        meal.name = "Lunch"
      }
      let arr = parent[diningHall.id]
      let token = cleanString(food)
      let result = false
      for (let item of arr) {
        if (item.includes(token)) {
          result = item;
          break;
        }
      }
      if (result) {
        output = (diningHall.name + " is serving " + result + " for " + meal.name.toLowerCase() + ".")
      }
      else {
        output = (diningHall.name + " is not serving " + token + " for " + meal.name.toLowerCase() + ".")
      }
    }
    catch (error) {
      console.log(`~~~~ Error handled: ${JSON.stringify(error)}`)
    }
    return handlerInput.responseBuilder.speak(output).getResponse()
  }
}

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" && Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent")
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak(HELP_MESSAGE).reprompt(HELP_REPROMPT).getResponse()
  }
}

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" && (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.CancelIntent" || Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent"))
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak(STOP_MESSAGE).getResponse()
  }
}

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" && Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.FallbackIntent")
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak(HELP_MESSAGE).reprompt(HELP_REPROMPT).getResponse()
  }
}

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest")
  },
  handle(handlerInput) {
    console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`)
    return handlerInput.responseBuilder.getResponse()
  }
}

const ErrorHandler = {
  canHandle() {
    return true
  },
  handle(handlerInput, error) {
    console.log(`~~~~ Error handled: ${JSON.stringify(error)}`)
    return handlerInput.responseBuilder.speak(FATAL_ERROR_MESSAGE).getResponse()
  }
}

const obtainHTML = async () => {
  let html = document.createElement("html")
  return new Promise((resolve, reject) => {
    request({
      uri: "https://hospitality.usc.edu/residential-dining-menus/"
    }, (error, response, body) => {
      html.innerHTML = response.body
      resolve(html)
    })
  })
}

const cleanString = (input) => {
  return input.toString().trim().toLowerCase().replace(/[^a-z ]+/g, "")
}


const parseMenuItems = (html) => {
  let pool = []
  let uls = html.querySelectorAll("ul.menu-item-list")
  for (let ul of uls) {
    let children = ul.querySelectorAll("li")
    for (let li of children) {
      let text = li.childNodes[0].data.toString().trim().toLowerCase()
      if (text.includes("(")) {
        text = text.split("(")[0].trim()
      }
      text = cleanString(text)
      pool.push(text)
    }
  }
  return pool
}

const parseMenuJSON = (html) => {
  let object = {}
  let accordians = html.querySelectorAll(".hsp-accordian-container")
  for (let accordian of accordians) {
    let valid = false
    let title = cleanString(accordian.querySelector(".fw-accordion-title-inner").textContent.split(" ")[0])
    object[title] = {}
    let sections = accordian.querySelectorAll("div.col-sm-6.col-md-4")
    for (let section of sections) {
      let location = LOCATION_ALIASES[cleanString(section.querySelector(".menu-venue-title").textContent)]
      object[title][location] = []
      let items = parseMenuItems(section)
      for (let item of items) {
        object[title][location].push(item)
      }
      if (items.length) {
        valid = true
      }
    }
    if (!valid) {
      delete object[title]
    }
  }
  return object
}

exports.handler = Alexa.SkillBuilders.custom().addRequestHandlers(LaunchRequestHandler, GetIntentHandler, VerifyIntentHandler, HelpIntentHandler, CancelAndStopIntentHandler, FallbackIntentHandler, SessionEndedRequestHandler).addErrorHandlers(ErrorHandler).lambda()
