
import * as mongoose from 'mongoose';
import { logger } from '../logging';
import { config } from '../config/config';

export type MongoDbOptions = {
    user?: string
    password?: string
    protocol: string
    host: string
    name: string
}

export class Database {
    private mongoDbOptions: MongoDbOptions;
    constructor(dbOptions?: MongoDbOptions) {
        this.mongoDbOptions = dbOptions ? { ...config.mongdb, ...dbOptions } : { ...config.mongdb };
    }

    public connect = async () => {
        try {
            const mongodbConnection = this.getMongoConnection();
            await mongoose.connect(mongodbConnection, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false });
            console.log('Connected to MongoDB on', mongodbConnection);
            logger.info(`Connected to MongoDB on ${mongodbConnection}`);
        } catch (err) {
            console.log(`${err} Could not connect to the database. Exiting Now...`);
            logger.error(`Could not connect to the database. Exiting Now...`, err);
            process.exit();
        }
    }

    private getMongoConnection = (): string => {
        const { user, password, protocol, host, name } = this.mongoDbOptions;
        let authentication = '';
        if (user && password) {
            authentication = `${user}:${password}@`;
        }
        return `${protocol}://${authentication}${host}/${name}`;
    }
}
