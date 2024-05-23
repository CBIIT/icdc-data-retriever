import { createLogger, transports, format } from "winston";

const logFormat = format.combine(format.timestamp(), format.json());

const logger = createLogger({
  level: "info",
  format: logFormat,
  transports: [
    new transports.Console(),
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combined.log" }),
  ],
});

export default logger;
