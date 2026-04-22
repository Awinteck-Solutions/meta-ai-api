import "reflect-metadata";
import { Express, Request, Response } from "express"
import * as express from 'express';
import * as bodyParser from "body-parser";
import { Router } from "./routes/all.routes";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import * as cors from 'cors';
import path = require("path");
import connectToDatabase from "./database/data-source";
import { env } from "./config/env";
import { logger } from "./helpers/logger";
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger-output.json"); 

const app = express();
app.use(cors())
app.use(bodyParser.json({
    verify: (req: Request & { rawBody?: string }, _res, buf) => {
        req.rawBody = buf.toString();
    },
}))
app.use(bodyParser.urlencoded({extended: true}))
app.use(Router)
app.use(errorHandler)


app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req: Request, res: Response) => { 
    res.json({
        message: 'Welcome to Template API'
    })
})



connectToDatabase().then(() => { 
    app.listen(env.port, ()=> logger.info(`Server running on port ${env.port}`))
}).catch((error) => {
    logger.error("Failed to start server", error);
})
