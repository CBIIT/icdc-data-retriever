import logger from "./utils/logger.js";
import fetchData from "./fetchData.js";

logger.info("starting data fetching...");
await fetchData.mapExternalDataToStudies();
logger.info("data fetching complete!");
