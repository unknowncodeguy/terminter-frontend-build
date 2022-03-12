import express from 'express';
import scrape from 'website-scraper'; // only as ESM, no CommonJS
import SaveToExistingDirectoryPlugin from 'website-scraper-existing-directory';

import fs from 'fs';
import fsExtra from 'fs-extra';
import cors from 'cors';
import util from 'util';
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import path from 'path';
import urlExist from 'url-exist'
import { match } from 'assert';

dotenv.config()

const app = express();

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

const __dirname = path.resolve();

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

app.post('/extract-machine', async function (req, res) {
    const scrapingUrl = req.body.scrapingUrl;
    const isExist = await urlExist(scrapingUrl)

    if(!isExist) {
        res.send({
            status: 'error',
            msg: 'invalid url'
        })
    }

    const options = {
        urls: [scrapingUrl],
        directory: `${__dirname}/download`,
        plugins: [ new SaveToExistingDirectoryPlugin() ],
        sources: [
            { selector: 'script', attr: 'src' }
        ]
    };
    
    fsExtra.emptyDirSync(`${__dirname}/download`)

    const reg_pattern = /[1-9A-Za-z]{40,70}/g;
    const rejectPubKeyList = [
        'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ',
        'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
        'faircnAB9k59Y4TXmLabBULeuTLgV7TkGMGNkjnA15j',
        'gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs',
        'cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ'
    ];

    const rejectFileRegPatternList = [
        /^_/,
        /^[0-9]/,
        /^webpack/,
        /^polyfill/,
        /^framework/,
        /^vendor/
    ]
    var candyMachineIds = [];
    try {
        const result = await scrape(options);
        if(result) {
            let fileNames = await readdir(`${__dirname}/download/js`);
            let indexFile = "";
            if(fileNames) {
                let usefulFileList = [];
                fileNames.forEach((fileName,index) => {
                    for(let i = 0; i < rejectFileRegPatternList.length; i++) {
                        if(fileName.match(rejectFileRegPatternList[i])) {
                            break;
                        }
                        if(i == (rejectFileRegPatternList.length - 1)) {
                            usefulFileList.push(fileName)
                        }
                    }
                })
                usefulFileList.forEach( async (fileName, index) => {
                    var fileData = await readFile(`${__dirname}/download/js/${fileName}`)
                    var str = fileData.toString();
                    var matchStr = str.match(reg_pattern)
                    if(matchStr) {
                        console.log(matchStr);
                        for(let i = 0;i < matchStr.length; i++) {
                            if(!rejectPubKeyList.includes(matchStr[i])){
                                candyMachineIds.push(matchStr[i]);
                            }
                        }
                    }
                    if(index == (usefulFileList.length - 1)) {
                        res.send({
                            status: 'success',
                            msg: candyMachineIds
                        })
                        console.log('scraping success')
                    }
                })
                
                
            } else {
                res.send({
                    status: 'error',
                    message: 'no js file exist'
                })
            }
        } else {
            res.send({
                status: 'error',
                message: 'scraping failed'
            })
        }
    } catch(err) {
        console.log(err)
    }
});

app.use(express.static(`${__dirname}/build`))

app.use('/*', (req, res) => {
  res.sendFile(`${__dirname}/build/index.html`)
})

const port = process.env.PORT || 3030;

app.listen(port, (e) => {
  console.info(`server started on port ${port}`); // eslint-disable-line no-console
});