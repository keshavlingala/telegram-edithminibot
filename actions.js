import axios from "axios";
import jokes from "./assets/jokes.js";
import {
  tmdb_api,
  movie_search_base,
  moviedetails,
  youtube_api,
  ffmpegPath,
  DIALOGFLOW_PROJECT_ID,
  DIALOGFLOW_PRIVATE_KEY,
  DIALOGFLOW_CLIENT_EMAIL,
  OPENWEATHERAPPID,
  open_weather_base,
  COVID_DATA
} from "./config.js";
import { google } from "googleapis";
const yapi = google.youtube({ version: "v3", auth: youtube_api });
import YoutubeMp3Downloader from "youtube-mp3-downloader";
import { SessionsClient } from '@google-cloud/dialogflow'


//  Actions
export const actions = {
  movie: async (query) => {
    const {
      data: { results, total_results },
    } = await axios.get(movie_search_base, {
      params: {
        api_key: tmdb_api,
        query: query,
        language: "en-US",
      },
    });
    if (!total_results) return {};
    // movie full description
    const movie = results.shift();
    return await axios.get(moviedetails + movie.id, {
      params: {
        api_key: tmdb_api,
      },
    });
  },
  joke: () => {
    return jokes[Math.floor(Math.random() * 387)];
  },
  youtube2mp3: (videoID, name, progress, finished, error) => {
    //  Call Back Actions
    const YD = new YoutubeMp3Downloader({
      ffmpegPath: ffmpegPath,
      outputPath: "./assets/mp3",
      youtubeVideoQuality: "highestaudio",
      queueParallelism: 2,
      progressTimeout: 2000,
      allowWebm: false,
    });
    YD.download(videoID, name + ".mp3");
    YD.on("finished", finished);
    YD.on("error", error);
    YD.on("progress", progress);
  },
  youtubeSearch: async (q) => {
    const {
      data: { items },
    } = await yapi.search.list({
      part: "snippet",
      q,
    });
    return items;
  },
  getVideoById: async (id) => {
    const {
      data: { items },
    } = await yapi.search.list({
      part: "snippet",
      q: id,
      maxResults: 1,
    });
    return items.length ? items[0] : null;
  },
  sendTextMessageToDialog: async (textMessage, sessionId) => {
    const session = new SessionsClient({
      credentials: {
        private_key: DIALOGFLOW_PRIVATE_KEY,
        client_email: DIALOGFLOW_CLIENT_EMAIL
      }
    });
    const sessionPath = session.projectAgentSessionPath(DIALOGFLOW_PROJECT_ID, sessionId + '' + new Date().getHours());
    try {
      let responses = await session.detectIntent({
        session: sessionPath,
        queryInput: {
          text: {
            text: textMessage,
            languageCode: 'en'
          }
        }
      })
      return responses[0]
    }
    catch (err) {
      console.error('DialogFlow.sendTextMessageToDialogFlow ERROR:', err);
      return null
    }
  },
  getWeather: async ({ latitude: lat, longitude: lon }) => {
    return (await axios.get(open_weather_base, {
      params: {
        lat, lon,
        appid: OPENWEATHERAPPID
      }
    })).data;
  },
  getCovidData: async (query) => {
    query=query.toLowerCase();
    return (await axios.get(COVID_DATA)).data
      ?.find(s => s?.state_name?.toLowerCase()?.includes(query))
  }
};
