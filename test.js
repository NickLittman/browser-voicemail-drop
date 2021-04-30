let userNumber = getUserNumber()

let number = await client.lookups.v1.phoneNumbers(userNumber)
                 .fetch({type: ['carrier']})

if (number.carrier.type != 'mobile') getUserNumber();
else {