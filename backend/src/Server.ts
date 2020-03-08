import "@tsed/swagger";
import "@tsed/typeorm";
import "@tsed/ajv";
import "reflect-metadata";
import multer from "multer";
import {
  ServerLoader,
  ServerSettings,
  GlobalAcceptMimesMiddleware,
  Request
} from "@tsed/common";
import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import methodOverride from "method-override";
import { SUPPORTED_MIME_TYPES } from "./controllers/MediaController";
import { AjvErrorObject } from "@tsed/ajv/lib/interfaces/IAjvSettings";
import {
  getMediaUploadDir,
  getSentryDsn,
  getVersion,
  getEnvironment
} from "./env";
dotenv.config();

const sentryDsn = getSentryDsn();

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: getVersion(),
    environment: getEnvironment()
  });
}

const rootDir = __dirname;
@ServerSettings({
  rootDir,
  // uncomment the following line if you want to use Multer with DiskStorage
  // see: https://github.com/expressjs/multer#diskstorage
  // uploadDir: `${getMediaUploadDir()}`,
  acceptMimes: ["application/json"],
  port: 3000,
  mount: {
    "/api/v1": "${rootDir}/controllers/**/*.ts"
  },
  componentsScan: [
    `${rootDir}/services/**/**.ts`,
    `${rootDir}/middlewares/**/**.ts`
  ],
  typeorm: [
    {
      name: "tg",
      type: "postgres",
      url: "postgres://tg@psql:5432/tg",
      synchronize: true,
      entities: [`${rootDir}/entities/*.ts`],
      migrations: [`${__dirname}/migrations/*{.ts,.js}`],
      subscribers: [`${__dirname}/subscriber/*{.ts,.js}`]
    }
  ],
  multer: {
    fileFilter: (req: Request, file: Express.Multer.File, cb) => {
      cb(null, SUPPORTED_MIME_TYPES.includes(file.mimetype));
    },
    // comment the following line if you want to use Multer with MemoryStorage
    // see: https://github.com/expressjs/multer#memorystorage
    storage: multer.memoryStorage()
  },
  swagger: [
    {
      path: "/docs"
    }
  ],
  ajv: {
    errorFormat: (error: AjvErrorObject) => {
      return `At ${error.modelName}${error.dataPath}, value '${error.data}' ${error.message}`;
    },
    options: { verbose: true }
  }
})
export class Server extends ServerLoader {
  /**
   * @returns {Server}
   */
  public $onMountingMiddlewares(): void | Promise<any> {
    this.use(GlobalAcceptMimesMiddleware)
      .use(cookieParser())
      .use(compression({}))
      .use(methodOverride())
      .use(cors())
      .use(bodyParser.json())
      .use(
        bodyParser.urlencoded({
          extended: true
        })
      );

    return null;
  }
}

new Server()
  .start()
  .then(async () => {
    console.log("server running");
  })
  .catch(err => {
    console.error(err);
  });
