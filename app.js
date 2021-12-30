require("dotenv").config();
const { Telegraf, Scenes, Markup, session } = require("telegraf");

const axios = require("axios");
const ChartJSImage = require('chart.js-image');
const fs = require("fs");
const path = require("path");

const { enter, leave } = Scenes.Stage;

function formatUserInput(userInput) {
    let formattedUserInput = userInput.split(", ");
    let bwSplit = formattedUserInput[2].split("R").join("").split("W");
    formattedUserInput[2] = `Round ${bwSplit[0]} Window ${bwSplit[1]}`;
    return formattedUserInput
}

// User chose Text Bid Results
const bidsInText = new Scenes.BaseScene("bidsInText");

bidsInText.enter(ctx => {
    ctx.replyWithHTML("How do you want to find your bids?\nOption 1: Specific term, course, bidding window and instructor\nOption 2: Specific term, course and bidding window", Markup.inlineKeyboard([
        Markup.button.callback("Option 1", "option1"),
        Markup.button.callback("Option 2", "option2")
    ]))
});

bidsInText.action("option1", enter("bidsInTextOption1"))
bidsInText.action("option2", enter("bidsInTextOption2"))
bidsInText.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    leave();
});

// User chose Option 1 from bidsInText
const bidsInTextOption1 = new Scenes.BaseScene("bidsInTextOption1");

bidsInTextOption1.enter(ctx => {
    ctx.replyWithHTML("To check for bids, please send me: term, course code, bidding window, instructor.\nExample: 2021-22 Term 2, IS215, R1BW1, Christopher Michael Poskitt")
})

bidsInTextOption1.action("back", enter("bidsInText"));
bidsInTextOption1.action("again", enter("bidsInTextOption1"));
bidsInTextOption1.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.")
    leave()
});

bidsInTextOption1.on("text", async (ctx) => {
    let [term, courseCode, biddingWindow, instructor] = formatUserInput(ctx.update.message.text)
    try {
        const results = await axios.get("http://localhost:5000/api/bidding", {
            params: {
                term: term,
                courseCode: courseCode.toUpperCase(),
                biddingWindow: biddingWindow,
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

// User chose Option 2 from bidsInText
const bidsInTextOption2 = new Scenes.BaseScene("bidsInTextOption2");

bidsInTextOption2.enter(ctx => {
    ctx.replyWithHTML("To check for bids, please send me: term, course code and bidding window.\n\nExample: <b>2021-22 Term 2, IS215, R1BW1</b>\n\nI will reply with a list of instructors for you to choose from!")
})

bidsInTextOption2.on("text", async (ctx) => {
    if (ctx.update.message.text.indexOf(', ') != -1) {
        let [term, courseCode, biddingWindow] = formatUserInput(ctx.update.message.text)
        ctx.scene.session.currInput = ctx.update.message.text;
        try {
            const results = await axios.get("http://localhost:5000/api/instructors", {
                params: {
                    term: term,
                    courseCode: courseCode,
                    biddingWindow: biddingWindow
                }
            });
            let msgReply = "To proceed, please select one of the following option numbers: \n\n";
            if (results.data.length !== 0) {
                ctx.scene.session.instructorArr = [];
                for (let i = 0; i < results.data.length; i++) {
                    msgReply += `/${i + 1} ${results.data[i]}\n`
                    ctx.scene.session.instructorArr.push(results.data[i])
                }
            } else {
                msgReply += "No results found, please try again!";
            }
            ctx.replyWithHTML(msgReply);
        } catch (error) {
            ctx.reply(`An error has occured. Please try again or contact our admin. Error message: ${error}`);
        }
    } else {
        let instructorIdx = parseInt(ctx.update.message.text.substring(1)) - 1;
        let userInput = ctx.scene.session.currInput + ", " + ctx.scene.session.instructorArr[instructorIdx];
        let [term, courseCode, biddingWindow, instructor] = formatUserInput(userInput)
        try {
            const results = await axios.get("http://localhost:5000/api/bidding", {
                params: {
                    term: term,
                    courseCode: courseCode,
                    biddingWindow: biddingWindow,
                    instructor: instructor
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
    }
});

bidsInTextOption2.action("back", enter("bidsInText"));
bidsInTextOption2.action("again", enter("bidsInTextOption2"));
bidsInTextOption2.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.")
    ctx.scene.leave()
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
const stage = new Scenes.Stage([bidsInText, bidsInTextOption1, bidsInTextOption2, bidsInGraph])
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