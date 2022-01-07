require("dotenv").config();
const { Telegraf, Scenes, Markup, session } = require("telegraf");

const axios = require("axios");
const QuickChart = require("quickchart-js");

const fs = require("fs");
const path = require("path");

const { enter } = Scenes.Stage;

function formatUserInput(userInput) {
    let formattedUserInput = userInput.split(", ");
    let bwSplit = formattedUserInput[2].split("R").join("").split("W");
    formattedUserInput[2] = `Round ${bwSplit[0]} Window ${bwSplit[1]}`;
    return formattedUserInput
}

// User chose Text Bid Results
const bidsInText = new Scenes.BaseScene("bidsInText");

bidsInText.enter(ctx => {
    ctx.replyWithHTML("How do you want to look at past bids?\nOption 1: Based on the specific term, course code, bidding window and instructor\nOption 2: Based on the specific term, course and bidding window", Markup.inlineKeyboard([
        Markup.button.callback("Option 1", "option1"),
        Markup.button.callback("Option 2", "option2")
    ]))
});

bidsInText.action("option1", enter("bidsInTextOption1"))
bidsInText.action("option2", enter("bidsInTextOption2"))
bidsInText.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});

// User chose Option 1 from bidsInText
const bidsInTextOption1 = new Scenes.BaseScene("bidsInTextOption1");

bidsInTextOption1.enter(ctx => {
    ctx.replyWithHTML("To check for bids, please send me: term, course code, bidding window, instructor.\nExample: 2021-22 Term 2, IS215, R1BW1, Christopher Michael Poskitt")
})

bidsInTextOption1.action("back", enter("bidsInText"));
bidsInTextOption1.action("again", enter("bidsInTextOption1"));
bidsInTextOption1.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
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
        ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`);
    }
});

// User chose Option 2 from bidsInText
const bidsInTextOption2 = new Scenes.BaseScene("bidsInTextOption2");

bidsInTextOption2.enter(ctx => {
    ctx.replyWithHTML("To check for bids, please send me: term, course code and bidding window.\n\nExample: <b>2021-22 Term 2, IS215, R1BW1</b>\n\nI will reply with a list of instructors for you to choose from!")
})

bidsInTextOption2.action("back", enter("bidsInText"));
bidsInTextOption2.action("again", enter("bidsInTextOption2"));
bidsInTextOption2.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});

bidsInTextOption2.hears(/^\/[0-9]+/, async ctx => {
    let instructorIdx = parseInt(ctx.update.message.text.substring(1)) - 1;
    if (ctx.scene.session.instructorArr == null || typeof ctx.scene.session.instructorArr[instructorIdx] === 'undefined') {
        ctx.replyWithHTML("Did you send a wrong input? Please try again!")
    } else {
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
            ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`);
        }
    }
});

bidsInTextOption2.on("text", async (ctx) => {
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
        ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`);
    }
});

// User chose Text Bid Results
const bidsInGraph = new Scenes.BaseScene("bidsInGraph");

bidsInGraph.enter(ctx => {
    ctx.replyWithHTML("To generate a graph with bids, please either of the following to continue:\nOption 1: View past bids by their term, course code, instructor and section\nOption 2: View all past bids by term and course code",
    Markup.inlineKeyboard([
        Markup.button.callback("Option 1", "option1"),
        Markup.button.callback("Option 2", "option2")
    ]));
});
bidsInGraph.action("option1", enter("bidsInGraphOption1"));
bidsInGraph.action("option2", enter("bidsInGraphOption2"));
bidsInGraph.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});

// User choose bidsInGraph - Option 1
const bidsInGraphOption1 = new Scenes.BaseScene("bidsInGraphOption1");
bidsInGraphOption1.enter(ctx => {
    ctx.replyWithHTML("Please send me the term, course code, instructor and section to generate the graph.\nExample: 2021-22 Term 2, IS215, Christopher Michael Poskitt, G7");
})
bidsInGraphOption1.action("back", enter("bidsInGraph"));
bidsInGraphOption1.action("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
})

bidsInGraphOption1.on("text", async (ctx) => {
    try {
        const userInput = ctx.update.message.text;
        let [term, courseCode, instructor, section] = userInput.split(", ");
        const results = await axios.get("http://localhost:5000/api/graphOption1", {
            params: {
                term: term,
                courseCode: courseCode.toUpperCase(),
                instructor: instructor.toUpperCase(),
                section: section.toUpperCase()
            }
        });

        if (results.data.length === 0) {
            ctx.reply("There is either no such course or no bids history for this course. Please try again or leave the bot to restart.");
            return;
        }

        let biddingWindows = [];
        let minBids = [];
        let medianBids = [];
        for (let result of results.data) {
            biddingWindows.push(result.biddingWindow);
            minBids.push(result.minBid);
            medianBids.push(results.medianBid);
        }
        biddingWindows = biddingWindows.reverse();

        const myChart = new QuickChart();
        myChart.setConfig({
            type: "bar",
            data: {
                labels: biddingWindows,
                datasets: [
                    {
                        type: "bar",
                        label: "Min bids",
                        backgroundColor: "rgba(255, 99, 132, 0.5)",
                        borderColor: "rgb(255, 99, 132)",
                        data: minBids
                    },
                    {
                        type: "line",
                        label: "Median bids",
                        backgroundColor: "rgba(75, 192, 192, 0.5)",
                        borderColor: "rgb(75, 192, 192)",
                        fill: false,
                        data: minBids
                    }
                ]
            },
            options: {
                title: {
                    text: "Your results"
                }
            }
        });
        await myChart.toFile(path.join(__dirname, "bidGraphOption1.png"));

        ctx.replyWithPhoto(
            { source: path.join(__dirname, "bidGraphOption1.png") },
            { 
                caption: "This is your graph.",
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    Markup.button.callback("Back", "back"),
                    Markup.button.callback("Leave", "leave")
                ])
            }
        );

        fs.unlink(path.join(__dirname, "bidGraphOption1.png"), err => {
            if (err) console.log(err)
            else {
                console.log("Deleted file: " + path.join(__dirname, "bidGraphOption1.png"))
            }
        });
    } catch (error) {
        ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`);
    }
})

// User choose bidsInGraph - Option 2
const bidsInGraphOption2 = new Scenes.BaseScene("bidsInGraphOption2");

bidsInGraphOption2.action("back", enter("bidsInGraph"));
bidsInGraphOption2.action("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});

bidsInGraphOption2.enter(ctx => {
    ctx.replyWithHTML("Please send me the term, course code, type of bid to generate the graph.\nExample: 2021-22 Term 2, IS215, median/min");
});
bidsInGraphOption2.on("text", async (ctx) => {
    try {
        const userInput = ctx.update.message.text;
        let [term, courseCode, metric] = userInput.split(", ");
        const results = await axios.get("http://localhost:5000/api/graphOption2", {
            params: {
                term: term,
                courseCode: courseCode.toUpperCase()
            }
        });

        if (results.data.length === 0) {
            ctx.reply("There is either no such course or no bids history for this course. Please try again or leave the bot to restart.");
            return;
        }

        let sortedResults = {};
        for (let result of results.data) {
            if (result.instructor in sortedResults) {
                if (result.section in sortedResults[result.instructor]) {
                    sortedResults[result.instructor][result.section]["biddingWindows"].push(result.biddingWindow);
                    sortedResults[result.instructor][result.section]["minBids"].push(result.minBid);
                    sortedResults[result.instructor][result.section]["medianBids"].push(result.medianBid);
                } else {
                    sortedResults[result.instructor][result.section] = {
                        biddingWindows: [result.biddingWindow],
                        minBids: [result.minBid],
                        medianBids: [result.medianBid]
                    };
                }
            } else {
                sortedResults[result.instructor] = {};
                sortedResults[result.instructor][result.section] = {
                    biddingWindows: [result.biddingWindow],
                    minBids: [result.minBid],
                    medianBids: [result.medianBid]
                };
            }
        }

        let dataConfigs = [];
        let biddingWindows;
        for (let instructor in sortedResults) {
            for (let section in sortedResults[instructor]) {
                let sectionInfo = sortedResults[instructor][section];
                if (!biddingWindows) {
                    biddingWindows = sectionInfo.biddingWindows.reverse();
                }

                let dataset = {
                    type: "line",
                    label: `${section}(${instructor})`,
                    fill: false,
                    borderColor: "#" + Math.floor(Math.random()*16777215).toString(16),
                    data: metric == "median" ? sectionInfo.medianBids.reverse() : sectionInfo.minBids.reverse()
                };
                dataConfigs.push(dataset);
            }
        }

        const myChart = new QuickChart();
        myChart.setConfig({
            type: "line",
            data: {
                labels: biddingWindows,
                datasets: dataConfigs
            },
            options: {
                title: {
                    text: `Your results for ${metric} bid`
                }
            }
        });
        await myChart.toFile(path.join(__dirname, "bidGraphOption2.png"));

        ctx.replyWithPhoto(
            { source: path.join(__dirname, "bidGraphOption2.png") },
            { 
                caption: "This is your graph.",
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    Markup.button.callback("Back", "back"),
                    Markup.button.callback("Leave", "leave")
                ])
            }
        );

        fs.unlink(path.join(__dirname, "bidGraphOption2.png"), err => {
            if (err) console.log(err)
            else {
                console.log("Deleted file: " + path.join(__dirname, "bidGraphOption2.png"))
            }
        });
    } catch (error) {
        ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`);
    }
});

const bot = new Telegraf(process.env.BOT_TOKEN)

// Staging the scenes
const stage = new Scenes.Stage([bidsInText, bidsInTextOption1, bidsInTextOption2, bidsInGraph, bidsInGraphOption1, bidsInGraphOption2])
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