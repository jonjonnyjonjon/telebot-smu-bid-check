require("dotenv").config();
const { Telegraf, Scenes, Markup, session } = require("telegraf");

const axios = require("axios");
const ChartJSImage = require('chart.js-image');
const fs = require("fs");
const path = require("path");

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
    leave();
});

// User chose Option 1 from bidsInText
const bidsInTextOption1 = new Scenes.BaseScene("bidsInTextOption1");

bidsInTextOption1.enter(ctx => {
    ctx.replyWithHTML("To check for bids, please send me: term, course code, bidding window, instructor.\nExample: 2021-22 Term 2, IS215, R1BW1, Christopher Michael Poskitt.")
})

bidsInTextOption1.action("back", enter("bidsInText"));
bidsInTextOption1.action("again", enter("bidsInTextOption1"));
bidsInTextOption1.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.")
    leave()
});

bidsInTextOption1.on("text", async (ctx) => {
    try {
        const userInput = ctx.update.message.text;
        let [term, courseCode, biddingWindow, instructor] = userInput.split(", ");
        let bwSplit = biddingWindow.split("R").join("").split("W");
        let bwFormatted = `Round ${bwSplit[0]} Window ${bwSplit[1]}`;
        // check length must be == 4
        // use a constants.js to export then import here to check the full spelling of R1W1
        const results = await axios.get("http://localhost:5000/api/bidding", {
            params: {
                term: term,
                courseCode: courseCode.toUpperCase(),
                biddingWindow: bwFormatted,
                instructor: instructor.toUpperCase()
            }
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

// User chose Text Bid Results
const bidsInGraph = new Scenes.BaseScene("bidsInGraph");

bidsInGraph.enter(ctx => {
    ctx.replyWithHTML("To generate a graph with bids, please send me: term, course code, instructor and section.\nExample: 2021-22 Term 2, IS215, Christopher Michael Poskitt, G7");
});

bidsInGraph.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.")
    leave()
});

bidsInGraph.on("text", async (ctx) => {
    try {
        const userInput = ctx.update.message.text;
        let [term, courseCode, instructor, section] = userInput.split(", ");
        const results = await axios.get("http://localhost:5000/api/forGraph", {
            params: {
                term: term,
                courseCode: courseCode.toUpperCase(),
                instructor: instructor.toUpperCase(),
                section: section.toUpperCase()
            }
        });

        let biddingWindows = [];
        let minBids = [];
        let medianBids = [];
        for (let result of results.data) {
            biddingWindows.push(result.biddingWindow);
            minBids.push(result.minBid);
            medianBids.push(results.medianBid);
        }
        
        const line_chart = ChartJSImage().chart({
            "type": "line",
            "data": {
                "labels": biddingWindows,
                "datasets": [
                    {
                        "label": "Min Bids",
                        "borderColor": "rgb(255,+99,+132)",
                        "backgroundColor": "rgba(255,+99,+132,+.5)",
                        "data": minBids
                    },
                    {
                        "label": "Median Bids",
                        "borderColor": "rgb(123,+99,+432)",
                        "backgroundColor": "rgba(255,+99,+132,+.5)",
                        "data": minBids
                    }
                ]
            },    
            "options": {
                "title": {
                    "display": true,
                    "text": "Your results"
                },
                "scales": {
                    "yAxes": [
                        {
                            "stacked": true,
                            "scaleLabel": {
                                "display": true,
                                "labelString": "e$"
                            }
                        }
                    ]
                }
            }
        })
        .backgroundColor('white')
        .width(500)
        .height(300);
        line_chart.toURL();
        await line_chart.toFile("bidChart.png");
        await line_chart.toDataURI();
        await line_chart.toBuffer();

        ctx.replyWithPhoto(
            {source: path.join(__dirname, "bidChart.png")},
            {caption: "This is your graph."}
        );

        fs.unlink(path.join(__dirname, "bidChart.png"), err => {
            if (err) console.log(err)
            else {
                console.log("Deleted file: " + path.join(__dirname, "bidChart.png"))
            }
        });
    } catch (error) {
        ctx.reply(`An error has occured. Please try again or contact our admin. Error message: ${error}`);
    }
})

const bot = new Telegraf(process.env.BOT_TOKEN)

// Staging the scenes
const stage = new Scenes.Stage([bidsInText, bidsInTextOption1, bidsInGraph])
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
bot.action("bidsInGraph", ctx => ctx.scene.enter("bidsInGraph"));

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))