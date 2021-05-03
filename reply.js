import axios from "axios";
import { apiToken, bot_base_url } from "./config.js";
import FormData from "form-data";
import { createReadStream, unlinkSync } from "fs";
const reply = (chatId, text, entities) => {
  return axios.post(`${bot_base_url}${apiToken}/sendMessage`, {
    chat_id: chatId,
    text,
    entities,
    disable_web_page_preview: true
  });
};

export const replyCard = (chat_id, text, inline_keyboard, photoURL) => {
  return axios.post(`${bot_base_url}${apiToken}/sendPhoto`, {
    chat_id,
    caption: text,
    reply_markup: {
      inline_keyboard,
    },
    photo: photoURL,
  });
};
export const youtubeActionReply = (chat_id, text, keyboard) => {
  return axios.post(`${bot_base_url}${apiToken}/sendMessage`, {
    chat_id,
    text,
    reply_markup: {
      keyboard,
    },
    disable_web_page_preview: true
  });
};
export const yt3progressUpdate = (chat_id, { progress: { percentage } }) => {
  return axios.post(`${bot_base_url}${apiToken}/sendMessage`, {
    chat_id,
    text: `Processing... ${percentage.toFixed(2)}%`,
    disable_notification: true,
  });
};
export const replyWithAudio = async (chat_id) => {
  console.log("Sending Audio file ", chat_id);
  var data = new FormData();
  data.append("chat_id", chat_id);
  data.append("audio", createReadStream(`assets/mp3/${chat_id}.mp3`));
  await axios.post(`${bot_base_url}${apiToken}/sendAudio`, data, {
    headers: data.getHeaders(),
  });
  return cleanUpFile(chat_id);
};
export const cleanUpFile = (fileName) => {
  return unlinkSync(`assets/mp3/${fileName}.mp3`);
};

export const locationRequestReply = (chat_id, text) => {
  return axios.post(
    `${bot_base_url}${apiToken}/sendMessage`,
    {
      chat_id,
      text,
      reply_markup: {
        keyboard: [
          [
            {
              text: "Send My Location",
              request_location: true
            }
          ]
        ],
        one_time_keyboard: true
      }
    }
  )
}

export const replyWithWeather = (chat_id, report) => {
  console.log(report)
  const { coord: { lat, lon }, weather, main, visibility, wind, dt, name, sys } = report
  const text =
    `Geo Coordinates: ${lat},${lon}
City Name: ${name}
Country: ${sys.country}
Weather Condition: ${weather.map(w=>`${w.main}:${w.description}`).join(', ')} 
Temperature: ${(main.temp - 273.15).toFixed(2)}°C
Feels Like: ${(main.feels_like - 273.15).toFixed(2)}°C
Atmospheric pressure: ${main.pressure} hPa
Humidity: ${main.humidity} %
Wind: ${wind.speed} meter/sec
Visibility: ${visibility} meters
Sunrise Time: 🌅 ${new Date(sys.sunrise * 1000).toLocaleString()} 
Sunset Time: 🌄 ${new Date(sys.sunset * 1000).toLocaleString()}
Time of data calculation: ${new Date(dt * 1000).toLocaleString()}
`
  return axios.post(
    `${bot_base_url}${apiToken}/sendPhoto`, {
    chat_id,
    caption: text,
    photo: `https://openweathermap.org/img/wn/${weather[0].icon}@2x.png`,
  }
  )
}

export default reply;
