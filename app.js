require("dotenv").config();
const { Telegraf, Scenes, Markup, session } = require("telegraf");

const axios = require("axios");

const { enter, leave } = Scenes.Stage;

// User chose Text Bid Results
const bidsInText = new Scenes.BaseScene("bidsInText");

bidsInText.enter(ctx => {
    ctx.replyWithHTML("How do you want to find your bids?\nOption 1: Specific term, course, bidding window and instructor\nOption 2: Specific term, course and bidding window", Markup.inlineKeyboard([
        Markup.button.callback("Option 1", "option1"),
        Markup.button.callback("Option 2", "option2")
    ]))
});
bidsInText.action("option1", enter("bidsInTextOption1"))
bidsInText.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});


// User chose Option 1 from bidsInText
const bidsInTextOption1 = new Scenes.BaseScene("bidsInTextOption1");

bidsInTextOption1.enter(ctx => {
    ctx.replyWithHTML("To check for bids, please send me: term, course code, bidding window, instructor.\nExample: 2021-22 Term 2, IS215, R1BW1, Christopher Michael Poskitt.")
})

bidsInTextOption1.on("text", async (ctx) => {
    try {
        const results = await axios.get("http://localhost:5000/api/bidding", {
            params: { userInput: ctx.update.message.text }
        });
        let msgReply = "Results for your query: \n\n";
        if (results.data.length !== 0) {
            for (let result of results.data) {
                msgReply += `<u>Section ${result.section}</u>\nClass Size: ${result.enrolledStudents} out of ${result.vacancy}\nOpening vacancy: ${result.openingVacancy}\nMedian Bid: ${result.medianBid}\nMin Bid: ${result.minBid}`;
                
                msgReply += "\n\n";
            }
        } else {
            msgReply += "No results found.";
        }
        ctx.replyWithHTML(msgReply, 
            Markup.inlineKeyboard([
                Markup.button.callback("Back", "back"),
                Markup.button.callback("Search again", "again")
            ])
        );
    } catch (error) {
        ctx.reply(`An error has occured. Please try again or contact our admin. Error message: ${error}`);
    }
});

bidsInTextOption1.action("back", enter("bidsInText"));
bidsInTextOption1.action("again", enter("bidsInTextOption1"));
bidsInTextOption1.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.")
    ctx.scene.leave()
});


const bot = new Telegraf(process.env.BOT_TOKEN)

// Staging the scenes
const stage = new Scenes.Stage([bidsInText, bidsInTextOption1])
bot.use(session())
bot.use(stage.middleware())

bot.start(ctx => {
    ctx.replyWithHTML("Welcome to SMU Bid Checker bot. What do you want to do today?", Markup.inlineKeyboard([
        Markup.button.callback("Bids in Text", "bidsInText"),
        Markup.button.callback("Bids in Graph", "bidsInGraph")
    ]))
});
bot.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.leaveChat();
})
bot.action("bidsInText", ctx => ctx.scene.enter("bidsInText"));
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))