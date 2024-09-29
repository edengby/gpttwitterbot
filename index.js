const axios = require('axios');
const Twitter = require('twitter');
const fs = require('fs');
const csv = require('csv-parser');
const levenshtein = require('fastest-levenshtein');

// Twitter API credentials
const client = new Twitter({
    consumer_key: '123123',
    consumer_secret: '456456',
    access_token_key: '789789',
    access_token_secret: '123456456798',
});

// Load city data
let cityData = [];

const csvHeaders = [
    'שם_ישוב',
    'סהכ',
    'גיל_0_5',
    'גיל_6_18',
    'גיל_19_45',
    'גיל_46_55',
    'גיל_56_64',
    'גיל_65_פלוס'
];

fs.createReadStream('cities.csv', { encoding: 'utf8' })
    .pipe(csv({ headers: csvHeaders, skipLines: 1 }))
    .on('data', (row) => {
        cityData.push(row);
    })
    .on('end', () => {
        console.log('City data loaded.');
        console.log(cityData[0]); // Log the first city to inspect structure
        // Start the bot after loading city data
        startBot();
    });

// Function to find the closest city name
function findCity(cityName) {
    let minDistance = Infinity;
    let closestCity = null;

    cityData.forEach((city) => {
        const cityNameFromCsv = city['שם_ישוב'];
        // Check for undefined or non-string city names
        if (typeof cityNameFromCsv !== 'string' || typeof cityName !== 'string') {
            console.error('Invalid city names:', cityNameFromCsv, cityName);
            return;
        }
        console.log('Comparing:', cityNameFromCsv, 'with', cityName);

        const distance = levenshtein.distance(cityNameFromCsv, cityName);
        if (distance < minDistance) {
            minDistance = distance;
            closestCity = city;
        }
    });

    return closestCity;
}

// Function to start the bot
function startBot() {
    setInterval(async () => {
        try {
            const response = await axios.get('https://api.tzevaadom.co.il/notifications');
            const data = response.data;

            if (data.length > 0) {
                let totalPeople = 0;
                let ageGroups = {
                    'גיל_0_5': 0,
                    'גיל_6_18': 0,
                    'גיל_19_45': 0,
                    'גיל_46_55': 0,
                    'גיל_56_64': 0,
                    'גיל_65_פלוס': 0,
                };

                data.forEach((alert) => {
                    alert.cities.forEach((cityName) => {
                        const city = findCity(cityName);
                        if (city) {
                            totalPeople += parseInt(city['סהכ']) || 0;
                            Object.keys(ageGroups).forEach((ageGroup) => {
                                ageGroups[ageGroup] += parseInt(city[ageGroup]) || 0;
                            });
                        } else {
                            console.log(`City not found: ${cityName}`);
                        }
                    });
                });

                // Construct the tweet
                let tweet = `${totalPeople} Israelis went into shelter\n\nIn the ages:\n`;
                Object.keys(ageGroups).forEach((ageGroup) => {
                    tweet += `${ageGroup}: ${ageGroups[ageGroup]}\n`;
                });

                // Post the tweet
                client.post('statuses/update', { status: tweet }, (error, tweet, response) => {
                    if (error) {
                        console.error('Error posting tweet:', error);
                    } else {
                        console.log('Tweet posted successfully.');
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, 1000); // Run every 1 second
}
