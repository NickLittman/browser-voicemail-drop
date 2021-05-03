'use strict';

require('dotenv').config();
const http = require('http');
const express = require('express');
const {urlencoded} = require('body-parser');
const qs = require('querystring');

const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const ClientCapability = twilio.jwt.ClientCapability;
const VoiceResponse = twilio.twiml.VoiceResponse;

let app = express();
app.use(express.static(__dirname + '/public'));
app.use(urlencoded({extended: false}));
app.use(express.json({
  type: ['application/json', 'text/plain']
}))

var currentCalls = [];

// Generate a Twilio Client capability token
app.get('/token', (request, response) => {
  const capability = new ClientCapability({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });

  capability.addScope(
    new ClientCapability.OutgoingClientScope({
      applicationSid: process.env.TWILIO_TWIML_APP_SID})
  );

  const token = capability.toJwt();

  // Include token in a JSON response
  response.send({
    token: token,
  });
});

// client.logLevel = 'debug';

app.post('/dropVoicemail', (req, res) => {
  console.log(`voicemail dropped to conference ${currentCalls[0]}!`);
  let voicemailText = qs.stringify(req.body);
  client.conferences(currentCalls[0].toString())
      .update({
        announceUrl: `https://bdfaba1cc0dd.ngrok.io/announce?${voicemailText}`,
        announceMethod: 'GET'
      })
      .then(conference => console.log(conference.friendlyName))
      .catch(() => {
        console.log(client.httpClient.lastResponse);
      });
});

app.get('/announce', (req, res) => {
  console.log(req.query);
  let twiml = new VoiceResponse();
  twiml.pause({
    until: "silence",
    length: "3",
    timeout: "15"
  })
  twiml.say(req.query.voicemail);
  res.contentType('text/xml');
  res.send(twiml.toString());
})

app.post('/dialCustomer', (req, res) => {
  console.log('dialing...');
  console.log(req.body);
  if (req.body.StatusCallbackEvent == 'announcement-end') {
    client.conferences(req.body.ConferenceSid).update({status: 'completed'});
  }
  else {
    if (req.body.SequenceNumber == 1) {
      client.conferences(req.body.ConferenceSid)
        .participants
        .create({
          from: process.env.TWILIO_NUMBER,
          to: req.query.number,
          endConferenceOnExit: true
        })
        .then(participant => {
          currentCalls.push(req.body.ConferenceSid);
          console.log(participant.callSid)
        });
    }
  }
})

// Create TwiML for outbound calls
app.post('/voice', (request, response) => {
  let voiceResponse = new VoiceResponse();
    voiceResponse.dial().conference("ConferenceTest", {
      statusCallback: `/dialCustomer?number=${request.body.number}`,
      statusCallbackEvent: "join announcement",
      earlyMedia: true,
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
    });

  response.type('text/xml');
  response.send(voiceResponse.toString());
});


let server = http.createServer(app);
let port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Express Server listening on *:${port}`);
});

module.exports = app;
