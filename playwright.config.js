import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export default defineConfig({testDir:'./e2e',workers:1,retries:0,use:{baseURL:'http://127.0.0.1:3107',headless:true,trace:'retain-on-failure',launchOptions:{executablePath:process.env.CEICOM_CHROMIUM||undefined,args:['--no-sandbox']}},webServer:{command:'node server/index.mjs',url:'http://127.0.0.1:3107',reuseExistingServer:false,timeout:30000,env:{PORT:'3107',CEICOM_OPEN:'0',CEICOM_HOME:mkdtempSync(join(tmpdir(),'ceicom-e2e-'))}}});
