import express from "express";
import bodyParser from "body-parser";
import reply, {
    cleanUpFile,
    deleteMessage,
    locationRequestReply,
    replyCard,
    replyWithAudio,
    replyWithWeather,
    youtubeActionReply,
    yt3progressUpdate
} from "./reply.js";
import {actions} from "./actions.js";
import {image_base} from "./config.js";

const app = express();

const port = process.env.PORT || 80;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const movie2Text = ({
                        title,
                        tagline,
                        genres,
                        budget,
                        popularity,
                        release_date,
                        revenue,
                        runtime,
                        production_companies,
                        overview,
                    }) => {
    return `Title: ${title}
Tagline: ${tagline}
Runtime: ${runtime}
Genres: ${genres.map((gen) => gen.name).join(", ")}
Release Date: ${release_date}
Revenue: $ ${revenue}
Budget: $ ${budget}
Production: ${production_companies.map((c) => c.name).join(", ")}
Popularity: ${popularity}
Overview: ${overview}`;
};

const youtubeItems2Text = (items) => {
    return `Youtube Search results:
${items
        .map(({snippet: {title, description}, id: {videoId}}) => {
            return `Title: ${title}
Link: https://youtu.be/${videoId}
----------------------------------------`;
        })
        .join("\n\n")}
`;
};

app.use(bodyParser.json());
// Endpoints
app.get("/", async (req, res) => {
    res.status(200).send("Hello World");
});
app.post("/", async (req, res, next) => {
    if (!req.body.message?.chat?.id) {
        console.error('Invalid Request', req.body)
        if (req.body.edited_message) {
            reply(req.body.edited_message.chat.id, 'Edited Messages not yet supported');
        }
        return res.status(200).end()
    }
    console.log(req.body.message);
    console.log("--------------------------------------");
    const msg = req.body.message?.text;
    const chatID = req.body.message?.chat?.id;
    const location = req.body.message?.location;
    // Author Credits
    if (msg && msg.match(/keshav/gim)) reply(chatID, "That's right!, He's my Creator!");

    if (location) {
        try {
            const weather = await actions.getWeather(location)
            await replyWithWeather(chatID, weather)
        } catch (err) {
            console.error('Weather Fetch error', err)
            reply(chatID, 'Error Occured');
        }
        return res.status(200).end();
    }
    // Features
    switch (msg) {
        case (/\/start|help/gim.exec(msg) || {}).input:
            await reply(
                chatID,
                `
I can help you get things done:

Commands:

joke    - get a random joke
movie   - search for movie details with name
yt      - search for youtube videos
yt3     - extract audio from youtube video ( ID or Link )
weather - For Weather information or directly send a location to know weather there
covid   - Check status of any state in india with covid command followed by the state name, (Data Updates every 15 mins)

Example Commands:
1. movie Big hero 6
2. joke
3. yt Faded by alan walker
4. yt3 https://www.youtube.com/watch?v=60ItHLz5WEA
or yt3 60ItHLz5WEA
5. covid telangana
..... more features will be added later
         `
            );
            return res.status(200).end();
            break;
        case (/\/?weather/gim.exec(msg) || {}).input:
            locationRequestReply(chatID, 'Share your location for weather report');
            return res.status(200).end();
            break;
        case (/\/?joke/gim.exec(msg) || {}).input:
            const joke = actions.joke();
            await reply(chatID, joke.setup);
            await sleep(1500);
            await reply(chatID, joke.punchline);
            res.status(200).end();
            break;
        case (/\/?movie/gim.exec(msg) || {}).input:
            // Movie Search Trigger
            const movieMatch = /\/?movie (.*)/gim.exec(msg);
            if (movieMatch) {
                const query = movieMatch[1];
                const {data: movie} = await actions.movie(query);
                console.log({movie});
                if (!movie) {
                    reply(
                        chatID,
                        "Cannot find any movies with that name, Try again with other queries"
                    );
                    return res.status(200).end();
                }
                if (!movie.poster_path) {
                    await reply(chatID, movie2Text(movie));
                } else {
                    await replyCard(chatID,
                        movie2Text(movie),
                        [
                            [
                                ...(movie.homepage
                                    ? [
                                        {
                                            text: "Website",
                                            url: movie.homepage,
                                        },
                                    ]
                                    : []),
                                {
                                    text: "IMDB",
                                    url: "https://www.imdb.com/title/" + movie.imdb_id,
                                },
                            ],
                        ],
                        image_base + movie.poster_path
                    );
                }
                return res.status(200).end();
            } else {
                // Instructions
                reply(chatID, "Search any movie with\nmovie <search query>", [
                    {
                        offset: 22,
                        length: 20,
                        type: "pre",
                    },
                ]);
                return res.status(200).end();
            }
        case (/^[ ]*yt3/gim.exec(msg) || {}).input:
            const yt3Match = /^[ ]*yt3 (.*)/gim.exec(msg);
            if (yt3Match) {
                let videoID;
                try {
                    videoID = yt3Match[1].includes("https://")
                        ? yt3Match[1].includes("watch")
                            ? /^[ ]*yt3 .*\?v=(.*)/gim.exec(yt3Match)[1]
                            : /^[ ]*yt3 .*\/(.*)/gim.exec(yt3Match)[1]
                        : yt3Match[1];
                    console.log("Video ID fetched", videoID);
                } catch (err) {
                    // invalid URL Error
                    // return
                    next(err);
                    return res.status(200).end();
                }
                console.log("Action started", videoID);
                const videoItem = await actions.getVideoById(videoID);
                if (!videoItem || videoItem.id.videoId != videoID) {
                    // Invalid Video ID
                    console.log("Invalid ID");
                    await reply(chatID, "Invalid Youtube Link or ID");
                    return res.status(200).end();
                }
                let messageId;
                actions.youtube2mp3(
                    videoID,
                    chatID,
                    async (progress) => {
                        if (!messageId) {
                            const resp = await yt3progressUpdate(chatID, progress)
                            messageId = resp.data.result.message_id
                        } else {
                            await yt3progressUpdate(chatID, progress, messageId)
                        }
                    },
                    async (finished) => {
                        try {
                            await replyWithAudio(chatID);
                            await deleteMessage(chatID, messageId)
                        } catch (err) {
                            console.error("Replay or Cleanup Error", err);
                        }
                        console.log(finished);
                        res.status(200).end();
                    },
                    async (error) => {
                        // console.error("ID Error", error);
                        try {
                            await reply(chatID, "Some Error Occurred");
                            await cleanUpFile(chatID);
                        } catch (err) {
                            console.error("Cleaning Up Error ", err);
                        }
                        return res.status(200).end();
                    }
                );
            } else {
                // Instructions
                await reply(
                    chatID,
                    "Download Youtube video as mp3 with yt3 command followed by link or ID"
                );
                return res.status(200).end();
            }
            return res.status(200).end();
            break;
        case (/^[ ]*yt/gim.exec(msg) || {}).input:
            // Youtube search Trigger
            const youtubeMatch = /^[ ]*yt (.*)/gim.exec(msg);
            if (youtubeMatch) {
                const youtubeSearchQuery = youtubeMatch[1];
                const items = await actions.youtubeSearch(youtubeSearchQuery);
                const keyboard = items.map(({id: {videoId}}) => {
                    return [
                        {
                            text: "yt3 " + videoId,
                        },
                    ];
                });
                await youtubeActionReply(chatID, youtubeItems2Text(items), keyboard);
                return res.status(200).end();
            } else {
                await reply(
                    chatID,
                    "Search for youtube video with yt command followed by your search keyword"
                );
                return res.status(200).end();
            }
        case (/^[ ]*covid/gmi.exec(msg) || {}).input:
            const covidQuery = /^[ ]*covid[ ]*(.*)/gmi.exec(msg);
            if (covidQuery) {
                const state = covidQuery[1];
                if (!state) {
                    await reply(
                        chatID,
                        "Check status of any state in india with covid command followed by the state name, (Data Updates every 15 mins)"
                    );
                    return res.status(200).end();
                }
                const cases = await actions.getCovidData(state);
                console.log(cases);
                if (!cases) {
                    await reply(
                        chatID,
                        "Invalid State Name of Request"
                    );
                    return res.status(200).end();
                }
                await reply(chatID, `
Source: https://www.mohfw.gov.in/

State: ${cases.state_name}

----------------------------------------

Active Cases 🟢
        
${cases.active}( Previous)
${cases.new_active - cases.active} (Today) 
= ${cases.new_active}

----------------------------------------

Cured/Discharged/Migrated ✅
        
${cases.cured} ( Previous)
${cases.new_cured - cases.cured} (Today)
= ${cases.new_cured}

----------------------------------------

Deaths 🔴⚰️

${cases.death} ( Previous)
${cases.new_death - cases.death} ( Today )
=${cases.new_death}

----------------------------------------

Data Updates every 15 mins
        `)
                return res.status(200).end();
            } else {
                await reply(
                    chatID,
                    "Search for any state deatails with covid command followed by the statename"
                );
                return res.status(200).end();
            }
        default:
            console.log("Not matched anything ", msg);
            try {
                const {queryResult: {fulfillmentText}} = await actions.sendTextMessageToDialog(msg, chatID)
                if (fulfillmentText)
                    await reply(chatID, fulfillmentText);
                else
                    await reply(chatID, msg);
            } catch (err) {
                await reply(chatID, msg);
                console.error('DialogFlow Request error');
                return res.status(200).end()
            }
            res.status(200).end();
    }
    console.log('Not matched cases nor default ', req.body)
    res.status(200).end();
});

// Error Handler
app.use(function (err, req, res) {
    // render the error page
    // Error Response is not sent because
    // on error telegram will send the same message over and over again
    console.error("Error Handled ", err);
    res.status(200).end();
});

// Listening
app.listen(port, () => {
    console.log(`Listening on port ${port} `);
});
