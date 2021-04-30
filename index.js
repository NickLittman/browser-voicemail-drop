'use strict';

require('dotenv').config();
const http = require('http');
const express = require('express');
const {urlencoded} = require('body-parser');
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const ClientCapability = twilio.jwt.ClientCapability;
const VoiceResponse = twilio.twiml.VoiceResponse;

let app = express();
app.use(express.static(__dirname + '/public'));
app.use(urlencoded({extended: false}));

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

app.post('/dialCustomer', (req, res) => {
  console.log('dialing...');
  console.log(req.body);
  if (req.body.SequenceNumber == 1) {
    client.conferences(req.body.ConferenceSid)
      .participants
      .create({from: process.env.TWILIO_NUMBER, to: req.query.number})
      .then(participant => console.log(participant.callSid));
  }
})

// Create TwiML for outbound calls
app.post('/voice', (request, response) => {
  let voiceResponse = new VoiceResponse();
    voiceResponse.dial().conference("ConferenceTest", {
      statusCallback: `/dialCustomer?number=${request.body.number}`,
      statusCallbackEvent: "join",
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
