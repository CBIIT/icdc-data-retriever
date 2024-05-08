import dotenv from "dotenv";
dotenv.config();

const config = {
  VERSION: process.env.VERSION,
  DATE: process.env.DATE,
  BENTO_BACKEND_GRAPHQL_URI: process.env.BENTO_BACKEND_GRAPHQL_URI,
};

function scanConfigObject(configObject) {
  if (!configObject.VERSION) {
    configObject.version = "Version not set!";
  }
  if (!configObject.DATE) {
    configObject.date = new Date();
  }
  let unsetVars = [];
  let filteredKeys = Object.keys(configObject).filter((key) => {
    return !["DATE", "VERSION"].includes(key);
  });
  for (const key in filteredKeys) {
    if (!configObject[filteredKeys[key]]) {
      unsetVars.push(filteredKeys[key]);
    }
  }
  if (unsetVars.length !== 0) {
    throw new Error(
      `The following environment variables are not set: ${unsetVars.join(", ")}`
    );
  }
}

scanConfigObject(config);

export default config;
