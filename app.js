require("dotenv").config();

const { Telegraf } = require("telegraf");
const axios = require("axios");
const bot = new Telegraf(process.env.BOT_TOKEN)

bot.start(ctx => {
    ctx.reply("Welcome to SMU Bid Checker bot. To check for bids, please send me: <course code>, <round and window number>, <instructor>. Example: IS215, Round 1B Window 1, Christopher Michael Poskitt.");   
});

bot.on("message", async (ctx) => {
    const userInput = ctx.update.message.text;
    let [courseCode, biddingWindow, instructor] = userInput.split(", ");
    try {
        const results = await axios.get("http://localhost:5000/api/bidding", {
            params: {
                courseCode: courseCode,
                biddingWindow: biddingWindow,
                instructor: instructor.toUpperCase()
            }
        });
        
        let msgReply = "Results for your query: \n";
        for (let result of results.data) {
            msgReply += `Section: ${result.section}\nVacancy: ${result.vacancy}\n Opening Vacancy: ${result.openingVacancy}\nBefore Process Vacancy: ${result.beforeProcessVacancy}\nAfter Process Vacancy: ${result.afterProcessVacancy}\nMedian Bid: ${result.medianBid}\nMin Bid: ${result.minBid}\nEnrolled: ${result.enrolledStudents}`
            
            msgReply += "\n\n"
        }
        ctx.replyWithHTML(msgReply);
    } catch (error) {
        console.log(error)
    }
});

bot.launch();