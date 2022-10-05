const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const puppeteer = require('puppeteer');
//Scraper

const login = async (page, username, password) => {
    await page.goto("https://kiitportal.kiituniversity.net/irj/portal/", { waitUntil: 'networkidle2', timeout: 0 });
    await page.focus("#logonuidfield");
    await page.keyboard.type(username);
    await page.focus("#logonpassfield");
    await page.keyboard.type(password);
    await Promise.all([
        page.keyboard.press("Enter"),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
    ])
    try {
        const userAuthFailed = (await page.$x("//span[contains( text ( ), 'User authentication failed ')]"))[0]
        if (!userAuthFailed) {
            throw "User Auth Success!";
        }
        console.log("User Auth Failed!");
        return;
    } catch (err) {
        const userAuthSucc = (await page.$x("//a[contains( text( ), 'Student Self Service')]"))[0]
        if (!userAuthSucc) {
            console.log("User Auth Failed!");
        }
        console.log("User Auth Success!");
        return;
    }
}
const getAttendance = async (page, year, session) => {

    const topStudentService = await page.$x("//a[contains( text( ), 'Student Self Service')]");
    await topStudentService[0].click();
    const internalPageFrame = await page.$("iframe[name='Desktop Inner Page   ']");
    const frame = await internalPageFrame.contentFrame();
    await frame.waitForNavigation({ waitUntil: 'networkidle2' });
    const leftStudentService = await frame.$x("//a[contains( text( ), 'Student Self Service')]");
    await Promise.all([
        await leftStudentService[0].click(),
        await frame.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
    const studentAttendanceLeftItem = await frame.$x("//a[contains( text( ), 'Student Attendance Details')]");
    await Promise.all([
        await studentAttendanceLeftItem[0].click(),
        await frame.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);
    await frame.waitForSelector("iframe[title='Student Attendance Details']");
    const attendanceFrameElement = await frame.$("iframe[title='Student Attendance Details']");
    const attendanceFrame = await attendanceFrameElement.contentFrame();
    await attendanceFrame.waitForSelector("#WD52");
    await attendanceFrame.waitForSelector("#WD6A");
    await attendanceFrame.waitForSelector("#WD77");
    const yearInput = await attendanceFrame.$("#WD52");
    const sessionInput = await attendanceFrame.$("#WD6A");
    const submitButton = await attendanceFrame.$("#WD77");
    await yearInput.type(year + '-' + (parseInt(year) + 1).toString());
    await sessionInput.type(session);
    await submitButton.click();
    await attendanceFrame.waitForSelector("#WDB7");
    await attendanceFrame.waitForSelector("#WD7A-contentTBody");
    const tableBody = await attendanceFrame.$("#WD7A-contentTBody");
    const rows = await tableBody.$$("span")
    var data = [];
    var tempData = [];
    var count = 0;
    for (var i = 0; i < rows.length; i++) {
        if (count == 9) {
            tempData = tempData.filter((v, i) => {
                return i % 2 == 0;
            })
            data.push(tempData);
            tempData = [];
            count = 0;
        }
        const value = await rows[i].evaluate(el => el.innerText);
        tempData.push(value);
        count += 0.5;

    }
    data.splice(0, 1);
    const finalData = { data: [] };
    for (var i = 0; i < data.length; i++) {
        const obj = {
            subject: data[i][0], presentDays: data[i][1], excuseDays: data[i][2],
            totalNoOfDays: data[i][3], totalPercentage: data[i][4],
            totalPercentageWithExcuses: data[i][5], facultyID: data[i][6], facultyName: data[i][7]
        }
        finalData['data'].push(obj);
    }
    return finalData;
}

const getData = async (username, password, year, session) => {
    const browser = await puppeteer.launch({
        headless: true,
        devtools: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
    });
    try {

        const page = await browser.newPage();
        await login(page, username, password);
        const attendanceData = await getAttendance(page, year, session);
        await browser.close();
        return attendanceData;
    } catch (err) {
        const attendanceData = { data: err }
        await browser.close();
        return attendanceData;
    }
};

// End Scraper



const app = express();
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cors());
app.use(morgan('combined'));
app.post('/getdata', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const year = req.body.year;
    const session = req.body.session;
    const data = await getData(username, password, year, session);
    res.send(data);
});
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
    console.log(`server started on port ${PORT}`);
});