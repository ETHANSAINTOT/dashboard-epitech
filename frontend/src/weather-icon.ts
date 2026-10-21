import clear from "./assets/weather/clear.png";
import clouds from "./assets/weather/clouds.png";
import drizzle from "./assets/weather/drizzle.png";
import humidity from "./assets/weather/humidity.png";
import mist from "./assets/weather/mist.png";
import rain from "./assets/weather/rain.png";
import snow from "./assets/weather/snow.png";
import wind from "./assets/weather/wind.png";

// key = the "icon" field sent by the back (CONDITIONS in backend/catalog/weather.py)
export const WEATHER_ICONS: Record<string, string> = { clear, clouds, drizzle, mist, rain, snow };

// an icon name the front does not know (added in the back later): clouds rather than a broken image
export const weatherIcon = (name: string) => WEATHER_ICONS[name] ?? clouds;

// the small ones next to the humidity and wind values. drawn in WHITE: invisible on a white background
export { humidity as humidityIcon, wind as windIcon };
