// import "./normal.css"; import "./ChatGPT.css";
import { useState, useRef, useEffect } from "react";
import React from "react";
import SideMenu from "./SideMenu";
import ChatBox from "./ChatBox";
import Editor from "@monaco-editor/react";
import { ResizableBox, onResize } from "react-resizable";

// import Progress from "./components/ProgressCodeCompletion";
// import { locales } from 'moment';

// import TestPage from './TestPage';

import { chatLogContext } from "./context/chatLogContext";

import { ThemeContext } from "./context/ThemeContext";

import { AllContext } from "./context/AllContext";

import { pipeline, env } from "@xenova/transformers";

import DisplayGraph from "../DisplayGraph";

import {
  savedChatIDs,
  getAllChatsFromDB,
  deleteSpecificChat,
  postInChatlogsToDB,
  getChatMessageByExperimentId,
  openaiChatCompletions,
  openaiChatCompletionsWithChatLog,
  getVES,
  initailChatBoxSetting,
  createChatID,
  generate_error,
  getSpecificChatbyChatId,
  openaiComletions,
  checkCodePackages,
  patchSpecificChat,
  postInChatlogsToDBWithExeId,
  postChats,
  patchChatToDB,
  getFilesURLs,
  checkStatus,
} from "../apiService";

// export default function ChatGPT({ experiment }) {
export default function ChatGPT({ experiment }) {
  let limitNumChatBox = 5;

  // current chat tap id
  const [current_chatTapID, setCurrent_chatTapID] = useState(0);

  // this is the number of chat boxes in the result page
  const [numChatBox, setNumChatBox] = useState(0);

  // this is the index of the current chattab where user is typing
  const [chatCurrentTempId, setChatCurrentTempId] = useState("");

  // loadLocalChatModel is boolean value that indicates whether the local chat model should be loaded
  // const [loadLocalChatModel, setLoadLocalChatModel] = useState(true);
  const [loadLocalChatModel, setLoadLocalChatModel] = useState(false);

  const [generator, setGenerator] = useState(null);

  const MODELS = ["Xenova/LaMini-Flan-T5-783M"];
  // const MODEL_NAMES = ["Tiny StarCoder", "Codegen 350M Mono", "StarCoderBase-1b"];
  const MODEL_NAMES = ["Chat"];

  // ready to show disply GOT or not
  const [readyToDisplayGOT, setReadyToDisplayGOT] = useState(false);

  useEffect(() => {
    // temp();
    console.log("chatCurrentTempId", chatCurrentTempId);
  }, [chatCurrentTempId]);

  // Create a reference to the worker object.
  // const worker = useRef(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  const monaco = useRef(null);
  const [monacoReady, setMonacoReady] = useState(false);
  const [language, setLanguage] = useState("python"); // Only allow python for now

  // Model loading
  const [ready, setReady] = useState(null);
  const [disabled, setDisabled] = useState(false);
  const [progressItems, setProgressItems] = useState([]);

  // Inputs and outputs
  const [model, setModel] = useState("Xenova/LaMini-Flan-T5-783M");
  const [maxNewTokens, setMaxNewTokens] = useState(45);
  const [code, setCode] = useState(
    '#Hello, this editor features a code completion function.\n#If you are unsure about what to write, please right-click within this editor and select the "Generate" button.\ndef fib(n):\n    """Calculates the nth Fibonacci number"""\n'
  );

  // Generation parameters
  // const [temperature, setTemperature] = useState(0.5);
  const [topK, setTopK] = useState(5);
  const [doSample, setDoSample] = useState(false);

  // button for generating code
  const [generateCodeButton, setGenerateCodeButton] = useState(false);

  // code completion setting toggle state
  const [codeCompletionToggle, setCodeCompletionToggle] = useState(true);

  // Create a reference to the worker object.
  const worker = useRef(null);

  let apiUrl = process.env.REACT_APP_API_URL;
  let apiPort = process.env.REACT_APP_API_PORT;
  let endpoint = "";

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(
        new URL("./hooks/worker.js", import.meta.url),
        {
          type: "module",
        }
      );
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case "initiate":
          // Model file start load: add a new progress item to the list.
          setReady(false);
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case "progress":
          // Model file progress: update one of the progress items.
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === e.data.file) {
                return { ...item, ...e.data };
              }
              return item;
            })
          );
          break;

        case "done":
          // Model file loaded: remove the progress item from the list.
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file)
          );
          break;

        case "ready":
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          break;

        case "update":
          // Generation update: update the output text.
          setCode(e.data.output);
          break;

        case "complete":
          // Generation complete: re-enable the "Generate" button
          setDisabled(false);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () =>
      worker.current.removeEventListener("message", onMessageReceived);
  });

  useEffect(() => {
    // id="chatgpt-space"
    // make this id="chatgpt-space" z hightest

    const fetchData = async () => {
      console.log("good-index-useEffect-fetchData");
      let savedChatIDs_list = await savedChatIDs();

      console.log("savedChatIDs_list", savedChatIDs_list);

      let last_chatTapID_in_the_list = 0;

      let lengthofChatIDs = savedChatIDs_list.length;

      // at least one chat box exists
      if (lengthofChatIDs != 0) {
        last_chatTapID_in_the_list = savedChatIDs_list[lengthofChatIDs - 1];
      }
      // there is no chat box
      else {
        last_chatTapID_in_the_list = 1;
        lengthofChatIDs = 1;
      }
      console.log("last_chatTapID_in_the_list", last_chatTapID_in_the_list);
      // set current chat tap id
      setCurrent_chatTapID(last_chatTapID_in_the_list);

      // set the number of chat boxes
      // let lengthofChatIDs = savedChatIDs_list.length;

      console.log("lengthofChatIDs", lengthofChatIDs);
      setNumChatBox(lengthofChatIDs);

      setChatCurrentTempId(lengthofChatIDs);

      //
      // await getEngines();
      await initailChatBoxSetting(last_chatTapID_in_the_list);
      await getAllChatsFromDBFilterbyExpIdSetChatbox(
        last_chatTapID_in_the_list,
        lengthofChatIDs
      );

      // setTapTitlesFunc(limitNumChatBox);
      setTapTitlesFunc(numChatBox);
      setLanModelReset(true);
    };

    fetchData();
  }, [window.location.href]);

  const [chatInput, setChatInput] = useState("");
  // By using let preSet,
  const [preSetPrompt, setPreSetPrompt] =
    useState(`If you are asked to show a dataframe or alter it, output the file as a csv locally. And generate a script of python code. I strongly ask you to always write the code between three backticks python and three backticks always. For example, \`\`\`python \n print("hello world") \n \`\`\` and when users want to see the dataframe, save it as a csv file locally. However do not use temparary file paths. For example, pd.read_csv('path/to/your/csv/file.csv') is not allowed. There is already df variable in the code. You can use it. For example, df.head() is allowed. And when users want to see plot, please save it locally. For example, plt.savefig('file.png') is allowed. 

    please make sure that any commenets should be in the form of #. For example, # this is a comment. or # Note: Please make sure to install the necessary libraries before running this code such as imblearn, pandas, matplotlib and sklearn.

    Please also make sure thant when you return python script, please comment out any explanation between \`\`\`python \n and \n \`\`\` . For example, 
    # Sure, here's an example code to create violin plots using seaborn library, where each column of a pandas dataframe is plotted as a separate violin plot and saved as a png file.
    
    import pandas as pd
    import seaborn as sns
    import matplotlib.pyplot as plt
    # Load sample data
    df = sns.load_dataset("tips")
    # Get column names
    cols = df.columns

    If you give me a code like this, I will give you a score of 0. Please make sure to comment out any explanation between \`\`\`python \n and \n \`\`\` . For example,

    \`\`\`python \n import pandas as pd \n
    from sklearn.model_selection import train_test_split \n
    from sklearn.preprocessing import StandardScaler \n
    from keras.models import Sequential \n
    from keras.layers import Dense \n
    import matplotlib.pyplot as plt \n
    # load the DataFrame \n
    df = pd.read_csv('your_dataframe.csv') \n \`\`\`

    In the case where machine learning task is required, please make sure to use df as the dataframe name, and save learning curve as a png file. Please do not load the data from the csv file. 

    In the case where python generates more than 2 image files (png, jpg, jpeg, etc), please make sure to zip all the files and save it as a zip file.

    Python version where the code is executed is 3.7.16. Please make sure to import packages that are reliable and stable on this version.
    
    In any situation where you need to manipulate a dataframe (df) and save it, for each column name, if it contains an underscore (_), replace the underscore with a hyphen (-).
    `);

  const [models, setModels] = useState([]);
  // const [temperature, setTemperature] = useState(0.5);
  const [temperature, setTemperature] = useState(0);
  // language model
  // const [currentModel, setCurrentModel] = useState("text-davinci-003");
  const [currentModel, setCurrentModel] = useState("gpt-3.5-turbo");

  // initial chat box setting
  const [chatLog, setChatLog] = useState([
    {
      user: "gpt",
      message: "How can I help you today?",
    },
  ]);

  // const [testID, setTestID] = useState(0);
  // true or false trigger for chat box

  // language model reset
  // This is a boolean value that indicates whether the language model should be reset
  // when user moves to a new experiment or new chat box, the lanModelReset should be true

  const [lanModelReset, setLanModelReset] = useState(false);

  // current experiment id
  const [currentExpId, setCurrentExpId] = useState("");

  // tap titles
  // tapTitles is an object that contains the title of each chat box
  const [tapTitles, setTapTitles] = useState({
    taptitles: "",
  });

  // modeforchatorcoderuning
  const [modeForChatOrCodeRunning, setModeForChatOrCodeRunning] =
    useState("chat");

  // extractedCode
  const [extractedCode, setExtractedCode] = useState({
    code: "",
  });

  const [tabluerData, setTabluerData] = useState([]);

  const [modeForTabluerData, setModeForTabluerData] = useState(false);

  const [booleanPackageInstall, setBooleanPackageInstall] = useState(false);

  // booleanCode for checking if the messageFromOpenai contains python code
  // const [booleanCode, setBooleanCode] = useState(false);

  const [isDark, setIsDark] = useState(false);

  // clear chats
  function clearChat() {
    setChatLog([]);
  }

  // load all the models
  async function getEngines() {
    // fetch("http://localhost:3080/models")
    await fetch(`${apiUrl}:${apiPort}/openai/v1/models`)
      .then((res) => res.json())
      .then((data) => {
        // filter elements whose id include "gpt"

        let filteredModel = data.data.filter((item) => item.id.includes("gpt"));

        console.log("filteredModel", filteredModel);

        setModels(filteredModel);
      });
  }

  function checkIfCode(messageFromOpenai) {
    // check if the messageFromOpenai contains python code. for example the messageFromOpenai looks like this:

    let booleanCode = false;
    messageFromOpenai.split("\n").forEach((line) => {
      console.log("checkIfCode-line", line);
      if (line.includes("```python")) {
        booleanCode = true;
      }
    });

    return booleanCode;
  }

  function extractCode(messageFromOpenai) {
    const regex = /```([\s\S]+?)```/;
    const match = regex.exec(messageFromOpenai);
    const code = match[1];

    console.log("messageFromOpenai", messageFromOpenai);

    console.log("extractCode", code);

    // console.log("match", match);

    return code;
  }

  // get all chats from db by chatid, and set setNumChatBox and setChatCurrentTempId
  async function getAllChatsFromDBFilterbyExpIdSetChatbox(
    current_chatTapID,
    countofchatids
  ) {
    // GET http://localhost:5080/chatapi/v1/chats

    console.log(
      "current_chatTapID getAllChatsFromDBFilterbyExpIdSetChatbox",
      current_chatTapID
    );

    // countofchatids
    console.log(
      "countofchatids getAllChatsFromDBFilterbyExpIdSetChatbox",
      countofchatids
    );

    let data = await getAllChatsFromDB(current_chatTapID);

    setNumChatBox(countofchatids);
    setCurrent_chatTapID(current_chatTapID);

    if (countofchatids >= limitNumChatBox) {
      document.getElementById("newchatbuttonForGOT").style.pointerEvents =
        "none";
    }

    let chatLogNew = [];

    // need to change
    for (let i = 0; i < data["chatlogs"].length; i++) {
      if (data["chatlogs"][i]["who"] == "user") {
        chatLogNew = [
          ...chatLogNew,
          {
            user: data["chatlogs"][i]["who"],
            message: data["chatlogs"][i]["message"],
            execution_id:
              data["chatlogs"][i]["_execution_id"] === undefined
                ? ""
                : data["chatlogs"][i]["_execution_id"],
          },
        ];
      } else if (data["chatlogs"][i]["who"] == "gpt") {
        chatLogNew = [
          ...chatLogNew,
          {
            user: data["chatlogs"][i]["who"],
            message: data["chatlogs"][i]["message"],
            execution_id:
              data["chatlogs"][i]["_execution_id"] === undefined
                ? ""
                : data["chatlogs"][i]["_execution_id"],

            // message: data["chatlogs"][i]["message"].split(/\n/).map(line => <div key={line}>{line}</div>)
          },
        ];
      }
    }
    // reverse the order of chatLogNew
    chatLogNew = chatLogNew.reverse();
    console.log("choi-chatLogNew", chatLogNew);
    setChatLog(chatLogNew);
  }

  function tokenChekcerForGPT3Point5Turbo(chatLogNewFormatFiltered) {
    // convert chatLogNewFormatFiltered to string
    // print data type of chatLogNewFormatFiltered

    let newChatLogNewFormatFiltered = chatLogNewFormatFiltered;

    let str = chatLogNewFormatFiltered.map((item) => item.content).join(" ");
    console.log("tokenChekcerForGPT3Point5Turbo-str", str);
    const tokens = str.split(" ");
    const tokenCount = tokens.length;

    console.log("tokenCount", tokenCount);

    if (tokenCount > 1000) {
      newChatLogNewFormatFiltered = chatLogNewFormatFiltered
        .slice(0, 3)
        .concat(chatLogNewFormatFiltered.slice(-3));
      console.log("newChatLogNewFormatFiltered", newChatLogNewFormatFiltered);
      // return newChatLogNewFormatFiltered;
    }

    return newChatLogNewFormatFiltered;
  }

  function extractPackagesOfCode(code) {
    let packages = [];
    let codeSplit = code.split("\n");
    codeSplit.forEach((item) => {
      if (
        (item.includes("import") && item.includes("as")) ||
        (item.includes("from") && item.includes("import"))
      ) {
        // find the index where "import" or from are located
        let index_import = item.indexOf("import");
        let index_from = item.indexOf("from");

        console.log("index_import", index_import);
        console.log("index_from", index_from);
        if (index_import === 0 || index_from === 0) {
          let itemSplit = item.split(" ");
          // import sklearn.datasets as datasets
          // for the above case.
          let pack = itemSplit[1].split(".")[0];

          packages.push(pack);
        }
      }
    });

    console.log("packages", packages);
    return packages;
  }

  // check if the packages are already installed or not
  // async function checkCodePackages(packagesArray) {
  //   // console.log("packagesArray",packagesArray)

  //   // POST http://localhost:5080/execapi/v1/executions/install
  //   // Content-Type: application/json

  //   // {
  //   // "command": "freeze"
  //   // }

  //   // let data = await fetch("${apiUrl}:${apiPort}/execapi/v1/packages", {
  //   //   method: "POST",
  //   //   headers: {
  //   //     "Content-Type": "application/json",
  //   //   },
  //   //   body: JSON.stringify({
  //   //     command: "freeze",
  //   //   }),
  //   // })
  //   //   .then((res) => res.json())
  //   //   .then((data) => {
  //   //     console.log("data-executions/install", data);
  //   //     return data;
  //   //   })
  //   //   .catch((err) => {
  //   //     console.log("err--checkCodePackages", err);
  //   //   });

  //   let response = await fetch(`${apiUrl}:${apiPort}/execapi/v1/packages`);
  //   let data = await response.json();

  //   console.log("data-executions/install", data);

  //   // let allInstalledPackages = data["exec_results"]["stdout"].split("\n");
  //   let allInstalledPackages = data["packages"];

  //   console.log("checkCodePackages-allInstalledPackages", allInstalledPackages);

  //   for (let i = 0; i < allInstalledPackages.length; i++) {
  //     allInstalledPackages[i] = allInstalledPackages[i].split("==")[0];
  //   }

  //   //  packagesArray , allInstalledPackages
  //   //  set substract
  //   // let packagesNotInstalled = packagesArray - allInstalledPackages

  //   let requiredPackages = new Set(packagesArray);
  //   let installedPackages = new Set(allInstalledPackages);

  //   const result = new Set(requiredPackages);

  //   //  set substract
  //   for (const elem of installedPackages) {
  //     result.delete(elem);
  //   }

  //   // console.log("checkCodePackages-packagesNotInstalled",packagesNotInstalled)

  //   // console.log("checkCodePackages-allInstalledPackages",allInstalledPackages)

  //   // console.log("checkCodePackages-result",result)

  //   // convert result to array
  //   let packagesNotInstalled = Array.from(result);

  //   return packagesNotInstalled;
  // }

  async function doubleCheckPackagesWithLLM(packagesNotInstalled) {
    // my prompt eng
    let preSet = `assume that you have the list of python packages: ${packagesNotInstalled}, that you want to install. However, you are not sure the list of python packages could be used to install the package. For example, let's assume that the list includes sklearn. However, when you install sklearn, you should use the official name, scikit-learn. For example, pip install sklearn does not work. But pip install scikit-learn works. So, you want to check if the list of python packages include official name of python packages. If not, you want to convert the list of python packages to the list of official name of python packages. Please give me the list of official name of python packages by unofficial name.Please return message in this format. {unofficial name:official name},
        that is, {sklearn:scikit-learn}.
        `;

    console.log(
      "doubleCheckPackagesWithLLM-packagesNotInstalled",
      packagesNotInstalled
    );

    let data = await openaiChatCompletions(currentModel, preSet);

    console.log("doubleCheckPackagesWithLLM-data", data);

    let messageFromOpenai = data.choices[0].message["content"];

    console.log(
      "doubleCheckPackagesWithLLM-messageFromOpenai",
      messageFromOpenai
    );

    return messageFromOpenai;
  }

  function convertToOfficialPackageName(
    listOfOfficialPackageName,
    packagesNotInstalled
  ) {
    // listOfOfficialPackageName is string like {sklearn:scikit-learn}

    // convert listOfOfficialPackageName to object
    let listOfOfficialPackageNameObject = JSON.parse(listOfOfficialPackageName);

    console.log(
      "convertToOfficialPackageName-listOfOfficialPackageNameObject",
      listOfOfficialPackageNameObject
    );
  }

  function replaceFirstBackticks(message) {
    // let str = "example string";
    let index = message.indexOf("```");

    // if index is -1, return
    if (index === -1) {
      return message;
    } else {
      // get string from index to 10
      let str = message.slice(index, index + 10);
      // if str does not include python, replace the first triple backtick with triple backtick + "python"
      if (!str.includes("python")) {
        // console.log("replaceFirstBackticks-before-message",message)
        message = message.replace(/```/, "```python");
        // console.log("replaceFirstBackticks-before-message",message)

        return message;
      } else {
        return message;
      }
    }
  }

  function addComments(codeSnippet) {
    const lines = codeSnippet.split("\n");
    const commentedLines = [];
    let isCodeBlock = false;
    for (const line of lines) {
      if (line.includes("```python")) {
        isCodeBlock = true;
      }

      if (isCodeBlock == false) {
        // if first character is not #, add #
        if (line[0] != "#") {
          commentedLines.push(`# ${line}`);
        } else {
          commentedLines.push(`${line}`);
        }
      }

      if (isCodeBlock == true) {
        commentedLines.push(`${line}`);

        if (
          line.includes("```") &&
          !line.includes("```python") &&
          isCodeBlock == true
        ) {
          isCodeBlock = false;
        }
      }
    }
    return commentedLines.join("\n");
  }

  function makeBlinking() {
    // get all classes names blinking
    let blinking = document.getElementsByClassName("blinkingCandi");

    console.log("makeBlinking-blinking", blinking);
    // chagne all classes names blinking noblinking
    for (let i = 0; i < blinking.length; i++) {
      blinking[i].className = "blinking";
    }
  }

  function nomoreBlinking() {
    // get all classes names blinking
    let blinking = document.getElementsByClassName("blinking");

    console.log("blinking.length", blinking.length);
    // chagne all classes names blinking noblinking
    for (let i = 0; i < blinking.length; i++) {
      console.log("nomoreBlinking-blinking[i]", blinking[i]);
      blinking[i].className = "noblinking";
    }
  }

  // function for fetching data json from backend
  // async function getGOTData() {

  // simple
  async function handleSubmit(e) {
    console.log("handleSubmit-e", e);
    // prevent page from refreshing
    e.preventDefault();

    // fetch the data.json file for the submitted chatInput and chatid
    // if the fetch is successful, then setReadyToDisplayGOT(true);
    setReadyToDisplayGOT(true);
    // make id chatSubmitFormID unvisible
    // document.getElementById("chatSubmitFormID").style.display = "none";

    // Get the element by its ID
    const textarea = document.getElementById("chatSubmitFormID");

    // Check if the element exists
    if (textarea) {
      // Make the textarea read-only
      textarea.readOnly = true;

      // Make the textarea invisible but still occupy space
      textarea.style.opacity = 0;
    }

    // make id showQuestionID visible
    // document.getElementById("showQuestionID").style.display = "block";

    // if the fetch is not successful, then setReadyToDisplayGOT(false);
    console.log("re");

    // readytoshowgot or not the state

    // let experimentId = experiment.data._id;
    // let current_chatTapID = 4;

    // let chatLogNew =[
    //     {
    //         user: "gpt",
    //         message: "How can I help you today?"
    //     }
    // ]

    let chatLogNew = [];

    chatLogNew = [
      ...chatLog,
      {
        user: "me",
        message: `${chatInput}`,
      },
    ];

    setChatInput("");
    setChatLog(chatLogNew);

    // GET http://localhost:5080/chatapi/v1/chats/experiment/${experimentId}
    // let data = await getChatMessageByExperimentId(experimentId);

    let chatid_list = await savedChatIDs();

    console.log(
      "chatid_list[chatCurrentTempId - 1]",
      chatid_list[chatCurrentTempId - 1]
    );

    let data = await getChatMessageByExperimentId(
      chatid_list[chatCurrentTempId - 1]
      // chatCurrentTempId
    );

    console.log("data--handleSubmit", data);

    // filter the data using _experiment_id
    // let filteredData = data.filter(
    //   (item) => item._experiment_id === experimentId
    // );

    let filteredData = data;

    console.log("chatInput", chatInput);

    console.log("filteredData", filteredData);

    // chatCurrentTempId is 1,2,3, ...
    // there is no 0 chatCurrentTempId.
    if (chatCurrentTempId === "") {
      setChatCurrentTempId(1);
    }

    if (chatInput !== undefined || chatInput !== "") {
      // await postInChatlogsToDB(
      //   filteredData[chatCurrentTempId - 1]["_id"],
      //   chatInput,
      //   "text",
      //   "user"
      // );

      console.log("current_chatTapID-choi", current_chatTapID);
      console.log("chatCurrentTempId-choi", chatCurrentTempId);

      console.log(
        "chatid_list[chatCurrentTempId - 1]",
        chatid_list[chatCurrentTempId - 1]
      );

      await postInChatlogsToDB(
        chatid_list[chatCurrentTempId - 1],
        chatInput,
        "text",
        "user"
      );
    }

    const messages = chatLogNew.map((message) => message.message).join("\n");

    console.log("data--messages", messages);

    // get the last message from the chatLogNew array
    let lastMessageFromUser = chatLogNew[chatLogNew.length - 1].message;

    // let feature_importances = {};
    // for (let i = 0; i < experiment.data.feature_importances.length; i++) {
    //   feature_importances[experiment.data.feature_names[i]] =
    //     experiment.data.feature_importances[i];
    // }

    // let preSet =`assume you are a data scientist that only programs in python. You are given a model mod and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n You are asked: ` + prompt + `\n Given this prompt if you are asked to make a plot, save the plot locally. If you are asked to show a dataframe or alter it, output the file as a csv to /data/lab/`+experiment.data._dataset_id;

    // let preSet =`assume you are a data scientist that only programs in python. You are given a model mod and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n You are asked: ` + prompt + `\n Given this prompt if you are asked to make a plot, save the plot locally. If you are asked to show a dataframe or alter it, output the file as a csv locally`;

    // my prompt eng
    // let preSet =`assume you are a data scientist that only programs in python. You are given a model named model and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n The dataframe df has 'target' as the output. You are asked: ` + `${chatInput}` + `\n Given this question if you are asked to make a plot, save the plot locally.

    // If you are asked to show a dataframe or alter it, output the file as a csv locally. And generate a script of python code. I strongly ask you to always write the code between three backticks python and three backticks always. For example, \`\`\`python \n print("hello world") \n \`\`\` and when users want to see the dataframe, save it as a csv file locally. However do not use temparary file paths. For example, pd.read_csv('path/to/your/csv/file.csv') is not allowed. There is already df variable in the code. You can use it. For example, df.head() is allowed. And when users want to see plot, please save it locally. For example, plt.savefig('file.png') is allowed.

    // In the case where you need to save csv, for each colum name, if it has _ in the name, replace _ with -.
    // please make sure that any commenets should be in the form of #. For example, # this is a comment. or # Note: Please make sure to install the necessary libraries before running this code such as imblearn, pandas, matplotlib and sklearn.

    // Please also make sure thant when you return python script, please comment out any explanation between \`\`\`python \n and \n \`\`\` . For example,
    // # Sure, here's an example code to create violin plots using seaborn library, where each column of a pandas dataframe is plotted as a separate violin plot and saved as a png file.

    // import pandas as pd
    // import seaborn as sns
    // import matplotlib.pyplot as plt
    // # Load sample data
    // df = sns.load_dataset("tips")
    // # Get column names
    // cols = df.columns

    // If you give me a code like this, I will give you a score of 0. Please make sure to comment out any explanation between \`\`\`python \n and \n \`\`\` . For example,

    // \`\`\`python \n import pandas as pd \n
    // from sklearn.model_selection import train_test_split \n
    // from sklearn.preprocessing import StandardScaler \n
    // from keras.models import Sequential \n
    // from keras.layers import Dense \n
    // import matplotlib.pyplot as plt \n
    // # load the DataFrame \n
    // df = pd.read_csv('your_dataframe.csv') \n \`\`\`

    // In the case where machine learning task is required, please make sure to use df as the dataframe name, and save learning curve as a png file. Please do not load the data from the csv file.

    // In the case where python generates more than 2 image files (png, jpg, jpeg, etc), please make sure to zip all the files and save it as a zip file.

    // Python version where the code is executed is 3.7.16. Please make sure to import packages that are reliable and stable on this version.`;

    let preSet =
      `assume you are a data scientist that only programs in python. You are given a model named model and dataframe df with the following performance:` +
      `\n The dataframe df has 'target' as the output. You are asked: ` +
      `${chatInput}` +
      `\n Given this question if you are asked to make a plot, save the plot locally.` +
      preSetPrompt +
      "Please make sure that you should always save what kinds of charts you create and the information for charts into a csv file. For example, if you plot a donut chart, save the percentage of each class, class names as a csv file, and the chart name: donut. These information will allow user to make responsive and interactive charts. Please make sure that you should replace '_' with '-' in column names" +
      "Please do not load the dataframe which is df=pd.read_csv('path/to/your/dataset.csv') becasue df is already assigned.";

    console.log("preSet", preSet);

    // let waitingMessage = "Please wait while I am thinking..";
    let waitingMessage = "..";
    console.log("waitingMessage.length", waitingMessage.length);
    let typingDelay = 10; // milliseconds per character

    // Before making the API call
    setChatLog((chatLogNew) => [
      ...chatLogNew,
      {
        user: "gpt",
        message: "",
        className: "blinking",
      },
    ]);

    autoScrollDown();

    // Gradually update the message (waitingMessage) with a delay
    let messageIndex = 0;
    let intervalId = setInterval(() => {
      if (messageIndex < waitingMessage.length) {
        setChatLog((chatLogNew) => [
          ...chatLogNew.slice(0, -1),
          {
            user: "gpt",
            message: waitingMessage.slice(0, messageIndex + 1),
            className: "blinking",
          },
        ]);
        messageIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, typingDelay);

    console.log("chatLogNew", chatLogNew);

    disableReadingInput();

    // await postInChatlogsToDB(filteredData[chatCurrentTempId-1]['_id'], waitingMessage, "text", "gpt");

    // data= await openaiChatCompletions(currentModel,preSet+lastMessageFromUser)

    // make chatLogNew

    // makeBlinking();

    let messageFromOpenai = "";
    // if loadLocalChatModel is true, then use local chat model
    // if loadLocalChatModel is false, then use openai chat model

    if (loadLocalChatModel === false) {
      data = await openaiChatCompletionsWithChatLog(
        currentModel,
        chatLogNew,
        preSet,
        lastMessageFromUser
      );

      nomoreBlinking();
      messageFromOpenai = data.choices[0].message["content"];

      console.log("messageFromOpenai", messageFromOpenai);
    } else if (loadLocalChatModel === true) {
      // let output = await generator(lastMessageFromUser, {
      //   max_new_tokens: 150,
      // });

      let model = "Xenova/LaMini-Flan-T5-783M";

      worker.current.postMessage({
        model,
        text: lastMessageFromUser,
        max_new_tokens: 150,
        // temperature,
        // top_k: topK,
        // do_sample: doSample,
      });

      let output = "";

      // Listening for output from the worker
      worker.current.onmessage = (event) => {
        if (event.data.status === "done") {
          const receivedOutput = event.data.output;
          console.log("Received output from event.data:", event.data);
          console.log("Received output from worker:", receivedOutput);
        }
      };

      // split the output into sentences by . or ? or !
      let splited_output = output[0].split(/\.|\?|!/);

      // remove the last element of the array from the splited_output array
      splited_output.pop();

      // concatenate the splited_output array
      splited_output = splited_output.join(". ");

      // add . to the end of the splited_output
      splited_output = splited_output + ".";

      console.log("processed_output:", splited_output);

      messageFromOpenai = splited_output;
    }

    // if messageFromOpenai is undefined, then set messageFromOpenai to "Sorry, I am not sure what you mean. Please try again."

    if (messageFromOpenai === undefined) {
      console.log("messageFromOpenai is undefined");
      messageFromOpenai =
        "Sorry, I am not sure what you mean. Please try again.";
    }

    messageFromOpenai = replaceFirstBackticks(messageFromOpenai);

    // if ```python in the messageFromOpenai, then run addComments(messageFromOpenai)

    if (messageFromOpenai.includes("```python")) {
      messageFromOpenai = addComments(messageFromOpenai);
    }

    console.log("messageFromOpenai", messageFromOpenai);

    // check```python and ``` in the messageFromOpenai

    // process the messageFromOpenai based on...
    // check if the messageFromOpenai contains python code.
    // if yes, then add "Do you want to run the code on Aliro?" to the messageFromOpenai in next line
    // if no, then do nothing

    let booleanCode = checkIfCode(messageFromOpenai);

    console.log("booleanCode", booleanCode);

    if (booleanCode) {
      let extractedCodeTemp = extractCode(messageFromOpenai);

      let packagesOfCode = extractPackagesOfCode(extractedCodeTemp);

      let packagesNotInstalled = await checkCodePackages(packagesOfCode);

      console.log("packagesNotInstalled", packagesNotInstalled);

      // make official package names of the packagesNotInstalled using LLM
      // let listOfOfficialPackageName=await doubleCheckPackagesWithLLM(packagesNotInstalled)

      // convert to the official package names
      // let officialPackagesNotInstalled=convertToOfficialPackageName(listOfOfficialPackageName,packagesNotInstalled)

      if (packagesNotInstalled.length > 0) {
        setBooleanPackageInstall(true);

        messageFromOpenai =
          packagesNotInstalled +
          " " +
          "package(s) is (are) not installed." +
          " " +
          "If you want to install the packages to run the below code, please click the button below. Conversely, if you want to modify the code, simply double-click on it, make the necessary changes, and then save by pressing the esc key." +
          "\n" +
          messageFromOpenai;
      } else {
        setBooleanPackageInstall(false);
        messageFromOpenai =
          "If you wish to execute the code on Aliro, please click on the button located below. Conversely, if you want to modify the code, simply double-click on it, make the necessary changes, and then save by pressing the esc key." +
          "\n" +
          messageFromOpenai;
      }

      // function for running the code on aliro
      // runCodeOnAliro(extractedCode);
      setExtractedCode({ ...extractedCode, code: extractedCodeTemp });
    }

    setChatLog((chatLog) => [
      ...chatLog.slice(0, -1),
      {
        user: "gpt",
        message: messageFromOpenai,
        className: "",
      },
    ]);

    await postInChatlogsToDB(
      chatid_list[chatCurrentTempId - 1],
      messageFromOpenai,
      "text",
      "gpt"
    );

    autoScrollDown();

    setLanModelReset(false);
    enableReadingInput();
  }

  // working
  async function handleSubmitForAudioToText(e, tempchatInput) {
    console.log("777-handleSubmitForAudioToText-e", e);
    console.log("777-handleSubmitForAudioToText-e-chatInput", tempchatInput);

    // // prevent page from refreshing
    e.preventDefault();

    // redundant chatinput check
    // let lastchatLog = "";
    // if (chatLog.length > 2) {
    //   lastchatLog = chatLog[chatLog.length - 2];

    //   if (lastchatLog.message === tempchatInput) {
    //     console.log("777-same!!!");
    //     return;
    //   }
    // }

    let chatLogNew = [];

    chatLogNew = [
      ...chatLog,
      {
        user: "me",
        message: `${tempchatInput}`,
      },
    ];

    console.log("777-chatLogNew-handleSubmitForAudioToText", chatLogNew);

    setChatInput("");
    setChatLog(chatLogNew);

    // GET http://localhost:5080/chatapi/v1/chats/experiment/${experimentId}
    // let data = await getChatMessageByExperimentId(experimentId);

    let chatid_list = await savedChatIDs();

    console.log(
      "chatid_list[chatCurrentTempId - 1]",
      chatid_list[chatCurrentTempId - 1]
    );

    let data = await getChatMessageByExperimentId(
      chatid_list[chatCurrentTempId - 1]
      // chatCurrentTempId
    );

    console.log("777-data--handleSubmit", data);

    // filter the data using _experiment_id
    // let filteredData = data.filter(
    //   (item) => item._experiment_id === experimentId
    // );

    let filteredData = data;

    console.log("777-chatInput", chatInput);

    console.log("777-filteredData", filteredData);

    // chatCurrentTempId is 1,2,3, ...
    // there is no 0 chatCurrentTempId.
    if (chatCurrentTempId === "") {
      setChatCurrentTempId(1);
    }

    if (tempchatInput !== undefined || tempchatInput !== "") {
      // await postInChatlogsToDB(
      //   filteredData[chatCurrentTempId - 1]["_id"],
      //   chatInput,
      //   "text",
      //   "user"
      // );

      console.log("777-current_chatTapID-choi", current_chatTapID);
      console.log("777-chatCurrentTempId-choi", chatCurrentTempId);

      await postInChatlogsToDB(
        chatid_list[chatCurrentTempId - 1],
        tempchatInput,
        "text",
        "user"
      );
    }

    const messages = chatLogNew.map((message) => message.message).join("\n");

    console.log("777-data--messages", messages);

    // get the last message from the chatLogNew array
    let lastMessageFromUser = chatLogNew[chatLogNew.length - 1].message;

    // let feature_importances = {};
    // for (let i = 0; i < experiment.data.feature_importances.length; i++) {
    //   feature_importances[experiment.data.feature_names[i]] =
    //     experiment.data.feature_importances[i];
    // }

    // let preSet =`assume you are a data scientist that only programs in python. You are given a model mod and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n You are asked: ` + prompt + `\n Given this prompt if you are asked to make a plot, save the plot locally. If you are asked to show a dataframe or alter it, output the file as a csv to /data/lab/`+experiment.data._dataset_id;

    // let preSet =`assume you are a data scientist that only programs in python. You are given a model mod and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n You are asked: ` + prompt + `\n Given this prompt if you are asked to make a plot, save the plot locally. If you are asked to show a dataframe or alter it, output the file as a csv locally`;

    // my prompt eng
    // let preSet =`assume you are a data scientist that only programs in python. You are given a model named model and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n The dataframe df has 'target' as the output. You are asked: ` + `${chatInput}` + `\n Given this question if you are asked to make a plot, save the plot locally.

    // If you are asked to show a dataframe or alter it, output the file as a csv locally. And generate a script of python code. I strongly ask you to always write the code between three backticks python and three backticks always. For example, \`\`\`python \n print("hello world") \n \`\`\` and when users want to see the dataframe, save it as a csv file locally. However do not use temparary file paths. For example, pd.read_csv('path/to/your/csv/file.csv') is not allowed. There is already df variable in the code. You can use it. For example, df.head() is allowed. And when users want to see plot, please save it locally. For example, plt.savefig('file.png') is allowed.

    // In the case where you need to save csv, for each colum name, if it has _ in the name, replace _ with -.
    // please make sure that any commenets should be in the form of #. For example, # this is a comment. or # Note: Please make sure to install the necessary libraries before running this code such as imblearn, pandas, matplotlib and sklearn.

    // Please also make sure thant when you return python script, please comment out any explanation between \`\`\`python \n and \n \`\`\` . For example,
    // # Sure, here's an example code to create violin plots using seaborn library, where each column of a pandas dataframe is plotted as a separate violin plot and saved as a png file.

    // import pandas as pd
    // import seaborn as sns
    // import matplotlib.pyplot as plt
    // # Load sample data
    // df = sns.load_dataset("tips")
    // # Get column names
    // cols = df.columns

    // If you give me a code like this, I will give you a score of 0. Please make sure to comment out any explanation between \`\`\`python \n and \n \`\`\` . For example,

    // \`\`\`python \n import pandas as pd \n
    // from sklearn.model_selection import train_test_split \n
    // from sklearn.preprocessing import StandardScaler \n
    // from keras.models import Sequential \n
    // from keras.layers import Dense \n
    // import matplotlib.pyplot as plt \n
    // # load the DataFrame \n
    // df = pd.read_csv('your_dataframe.csv') \n \`\`\`

    // In the case where machine learning task is required, please make sure to use df as the dataframe name, and save learning curve as a png file. Please do not load the data from the csv file.

    // In the case where python generates more than 2 image files (png, jpg, jpeg, etc), please make sure to zip all the files and save it as a zip file.

    // Python version where the code is executed is 3.7.16. Please make sure to import packages that are reliable and stable on this version.`;

    let preSet =
      `assume you are a data scientist that only programs in python. You are given a model named model and dataframe df with the following performance:` +
      `\n The dataframe df has 'target' as the output. You are asked: ` +
      `${tempchatInput}` +
      `\n Given this question if you are asked to make a plot, save the plot locally.` +
      preSetPrompt +
      "Please make sure that you should always save what kinds of charts you create and the information for charts into a csv file. For example, if you plot a donut chart, save the percentage of each class, class names as a csv file, and the chart name: donut. These information will allow user to make responsive and interactive charts. Please make sure that you should replace '_' with '-' in column names" +
      "Please do not load the dataframe which is df=pd.read_csv('path/to/your/dataset.csv') becasue df is already assigned.";

    // console.log("777-preSet", preSet);

    // let waitingMessage = "Please wait while I am thinking..";
    let waitingMessage = "..";
    console.log("777-waitingMessage.length", waitingMessage.length);
    let typingDelay = 10; // milliseconds per character

    // Before making the API call
    setChatLog((chatLogNew) => [
      ...chatLogNew,
      {
        user: "gpt",
        message: "",
        className: "blinking",
      },
    ]);

    autoScrollDown();

    // Gradually update the message (waitingMessage) with a delay
    let messageIndex = 0;
    let intervalId = setInterval(() => {
      if (messageIndex < waitingMessage.length) {
        setChatLog((chatLogNew) => [
          ...chatLogNew.slice(0, -1),
          {
            user: "gpt",
            message: waitingMessage.slice(0, messageIndex + 1),
            className: "blinking",
          },
        ]);
        messageIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, typingDelay);

    console.log("777-999-chatLogNew", chatLogNew);

    disableReadingInput();

    // await postInChatlogsToDB(filteredData[chatCurrentTempId-1]['_id'], waitingMessage, "text", "gpt");

    // data= await openaiChatCompletions(currentModel,preSet+lastMessageFromUser)

    // make chatLogNew

    // makeBlinking();

    data = await openaiChatCompletionsWithChatLog(
      currentModel,
      chatLogNew,
      preSet,
      lastMessageFromUser
    );

    nomoreBlinking();

    console.log("choi-data", data);
    console.log("777-returned-data", data);

    let messageFromOpenai = data.choices[0].message["content"];

    if (messageFromOpenai === undefined) {
      console.log("messageFromOpenai is undefined");
      messageFromOpenai =
        "Sorry, I am not sure what you mean. Please try again.";
    }

    messageFromOpenai = replaceFirstBackticks(messageFromOpenai);

    // if ```python in the messageFromOpenai, then run addComments(messageFromOpenai)

    if (messageFromOpenai.includes("```python")) {
      messageFromOpenai = addComments(messageFromOpenai);
    }

    console.log("777-messageFromOpenai", messageFromOpenai);
    // speech to text using web speech api
    let toSpeak = new SpeechSynthesisUtterance(messageFromOpenai);
    toSpeak.lang = "en-US";
    toSpeak.rate = 1;
    toSpeak.pitch = 1;
    speechSynthesis.speak(toSpeak);

    document
      .getElementById("stopSpeaking")
      .addEventListener("click", function () {
        speechSynthesis.cancel();
      });

    // function startSpeaking() {
    //   speechSynthesis.speak(toSpeak);
    // }

    // check```python and ``` in the messageFromOpenai

    // process the messageFromOpenai based on...
    // check if the messageFromOpenai contains python code.
    // if yes, then add "Do you want to run the code on Aliro?" to the messageFromOpenai in next line
    // if no, then do nothing

    let booleanCode = checkIfCode(messageFromOpenai);

    console.log("777-booleanCode", booleanCode);

    if (booleanCode) {
      let extractedCodeTemp = extractCode(messageFromOpenai);

      let packagesOfCode = extractPackagesOfCode(extractedCodeTemp);

      let packagesNotInstalled = await checkCodePackages(packagesOfCode);

      console.log("packagesNotInstalled", packagesNotInstalled);

      // make official package names of the packagesNotInstalled using LLM
      // let listOfOfficialPackageName=await doubleCheckPackagesWithLLM(packagesNotInstalled)

      // convert to the official package names
      // let officialPackagesNotInstalled=convertToOfficialPackageName(listOfOfficialPackageName,packagesNotInstalled)

      if (packagesNotInstalled.length > 0) {
        setBooleanPackageInstall(true);

        messageFromOpenai =
          packagesNotInstalled +
          " " +
          "package(s) is (are) not installed." +
          " " +
          "If you want to install the packages to run the below code, please click the button below. Conversely, if you want to modify the code, simply double-click on it, make the necessary changes, and then save by pressing the esc key." +
          "\n" +
          messageFromOpenai;
      } else {
        setBooleanPackageInstall(false);
        messageFromOpenai =
          "If you wish to execute the code on Aliro, please click on the button located below. Conversely, if you want to modify the code, simply double-click on it, make the necessary changes, and then save by pressing the esc key." +
          "\n" +
          messageFromOpenai;
      }

      // function for running the code on aliro
      // runCodeOnAliro(extractedCode);
      setExtractedCode({ ...extractedCode, code: extractedCodeTemp });
    }

    if (messageFromOpenai) {
      console.log("777-call postInChatlogsToDB");
    }
    setChatLog((chatLog) => [
      ...chatLog.slice(0, -1),
      {
        user: "gpt",
        message: messageFromOpenai,
        className: "",
      },
    ]);

    await postInChatlogsToDB(
      chatid_list[chatCurrentTempId - 1],
      messageFromOpenai,
      "text",
      "gpt"
    );

    autoScrollDown();

    setLanModelReset(false);
    enableReadingInput();
  }

  async function handleSubmitFromEditor(e, code) {
    // prevent page from refreshing
    e.preventDefault();

    console.log("handleSubmitFromEditor-code", code);

    // let experimentId = experiment.data._id;
    // let current_chatTapID = 4;

    // let chatLogNew =[
    //     {
    //         user: "gpt",
    //         message: "How can I help you today?"
    //     }
    // ]

    let chatLogNew = [];

    chatLogNew = [
      ...chatLog,
      {
        user: "me",
        message: `${code}`,
      },
    ];

    setChatInput("");
    setChatLog(chatLogNew);

    // GET http://localhost:5080/chatapi/v1/chats/experiment/${experimentId}
    // let data = await getChatMessageByExperimentId(experimentId);

    let chatid_list = await savedChatIDs();

    console.log(
      "chatid_list[chatCurrentTempId - 1]",
      chatid_list[chatCurrentTempId - 1]
    );

    let data = await getChatMessageByExperimentId(
      chatid_list[chatCurrentTempId - 1]
      // chatCurrentTempId
    );

    console.log("data--handleSubmit", data);

    // filter the data using _experiment_id
    // let filteredData = data.filter(
    //   (item) => item._experiment_id === experimentId
    // );

    let filteredData = data;

    console.log("chatInput", code);

    console.log("filteredData", filteredData);

    // chatCurrentTempId is 1,2,3, ...
    // there is no 0 chatCurrentTempId.
    if (chatCurrentTempId === "") {
      setChatCurrentTempId(1);
    }

    if (code !== undefined || code !== "") {
      // await postInChatlogsToDB(
      //   filteredData[chatCurrentTempId - 1]["_id"],
      //   chatInput,
      //   "text",
      //   "user"
      // );

      console.log("current_chatTapID-choi", current_chatTapID);
      console.log("chatCurrentTempId-choi", chatCurrentTempId);

      await postInChatlogsToDB(
        chatid_list[chatCurrentTempId - 1],
        // chatInput,
        code,
        "text",
        "user"
      );
    }

    const messages = chatLogNew.map((message) => message.message).join("\n");

    console.log("data--messages", messages);

    // get the last message from the chatLogNew array
    let lastMessageFromUser = chatLogNew[chatLogNew.length - 1].message;

    // let feature_importances = {};
    // for (let i = 0; i < experiment.data.feature_importances.length; i++) {
    //   feature_importances[experiment.data.feature_names[i]] =
    //     experiment.data.feature_importances[i];
    // }

    // let preSet =`assume you are a data scientist that only programs in python. You are given a model mod and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n You are asked: ` + prompt + `\n Given this prompt if you are asked to make a plot, save the plot locally. If you are asked to show a dataframe or alter it, output the file as a csv to /data/lab/`+experiment.data._dataset_id;

    // let preSet =`assume you are a data scientist that only programs in python. You are given a model mod and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n You are asked: ` + prompt + `\n Given this prompt if you are asked to make a plot, save the plot locally. If you are asked to show a dataframe or alter it, output the file as a csv locally`;

    // my prompt eng
    // let preSet =`assume you are a data scientist that only programs in python. You are given a model named model and dataframe df with the following performance:` + `{"params":`+ JSON.stringify(experiment.data.params) +`,"algorithm":`+ experiment.data.algorithm +`,"scores":`+ JSON.stringify(experiment.data.scores) +`feature_importance_type :`+ experiment.data.feature_importance_type +`,"feature_importances":`+ JSON.stringify(feature_importances) +`}` + `\n The dataframe df has 'target' as the output. You are asked: ` + `${chatInput}` + `\n Given this question if you are asked to make a plot, save the plot locally.

    // If you are asked to show a dataframe or alter it, output the file as a csv locally. And generate a script of python code. I strongly ask you to always write the code between three backticks python and three backticks always. For example, \`\`\`python \n print("hello world") \n \`\`\` and when users want to see the dataframe, save it as a csv file locally. However do not use temparary file paths. For example, pd.read_csv('path/to/your/csv/file.csv') is not allowed. There is already df variable in the code. You can use it. For example, df.head() is allowed. And when users want to see plot, please save it locally. For example, plt.savefig('file.png') is allowed.

    // In the case where you need to save csv, for each colum name, if it has _ in the name, replace _ with -.
    // please make sure that any commenets should be in the form of #. For example, # this is a comment. or # Note: Please make sure to install the necessary libraries before running this code such as imblearn, pandas, matplotlib and sklearn.

    // Please also make sure thant when you return python script, please comment out any explanation between \`\`\`python \n and \n \`\`\` . For example,
    // # Sure, here's an example code to create violin plots using seaborn library, where each column of a pandas dataframe is plotted as a separate violin plot and saved as a png file.

    // import pandas as pd
    // import seaborn as sns
    // import matplotlib.pyplot as plt
    // # Load sample data
    // df = sns.load_dataset("tips")
    // # Get column names
    // cols = df.columns

    // If you give me a code like this, I will give you a score of 0. Please make sure to comment out any explanation between \`\`\`python \n and \n \`\`\` . For example,

    // \`\`\`python \n import pandas as pd \n
    // from sklearn.model_selection import train_test_split \n
    // from sklearn.preprocessing import StandardScaler \n
    // from keras.models import Sequential \n
    // from keras.layers import Dense \n
    // import matplotlib.pyplot as plt \n
    // # load the DataFrame \n
    // df = pd.read_csv('your_dataframe.csv') \n \`\`\`

    // In the case where machine learning task is required, please make sure to use df as the dataframe name, and save learning curve as a png file. Please do not load the data from the csv file.

    // In the case where python generates more than 2 image files (png, jpg, jpeg, etc), please make sure to zip all the files and save it as a zip file.

    // Python version where the code is executed is 3.7.16. Please make sure to import packages that are reliable and stable on this version.`;

    let preSet =
      `assume you are a data scientist that only programs in python. You are given a model named model and dataframe df with the following performance:` +
      `\n The dataframe df has 'target' as the output. You are asked: ` +
      `${code}` +
      `\n Given this question if you are asked to make a plot, save the plot locally.` +
      preSetPrompt +
      "Please make sure that you should always save what kinds of charts you create and the information for charts into a csv file. For example, if you plot a donut chart, save the percentage of each class, class names as a csv file, and the chart name: donut. These information will allow user to make responsive and interactive charts. Please make sure that you should replace '_' with '-' in column names" +
      "Please do not load the dataframe which is df=pd.read_csv('path/to/your/dataset.csv') becasue df is already assigned.";

    console.log("preSet", preSet);

    // let waitingMessage = "Please wait while I am thinking..";
    let waitingMessage = "..";
    console.log("waitingMessage.length", waitingMessage.length);
    let typingDelay = 10; // milliseconds per character

    // Before making the API call
    setChatLog((chatLogNew) => [
      ...chatLogNew,
      {
        user: "gpt",
        message: "",
        className: "blinking",
      },
    ]);

    autoScrollDown();

    // Gradually update the message (waitingMessage) with a delay
    let messageIndex = 0;
    let intervalId = setInterval(() => {
      if (messageIndex < waitingMessage.length) {
        setChatLog((chatLogNew) => [
          ...chatLogNew.slice(0, -1),
          {
            user: "gpt",
            message: waitingMessage.slice(0, messageIndex + 1),
            className: "blinking",
          },
        ]);
        messageIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, typingDelay);

    console.log("chatLogNew", chatLogNew);

    disableReadingInput();

    // await postInChatlogsToDB(filteredData[chatCurrentTempId-1]['_id'], waitingMessage, "text", "gpt");

    // data= await openaiChatCompletions(currentModel,preSet+lastMessageFromUser)

    // make chatLogNew

    // makeBlinking();

    data = await openaiChatCompletionsWithChatLog(
      currentModel,
      chatLogNew,
      preSet,
      lastMessageFromUser
    );

    console.log("hi-data", data);

    nomoreBlinking();

    console.log("returned-data", data);

    let messageFromOpenai = data.choices[0].message["content"];

    console.log("messageFromOpenai", messageFromOpenai);

    // if messageFromOpenai is undefined, then set messageFromOpenai to "Sorry, I am not sure what you mean. Please try again."

    if (messageFromOpenai === undefined) {
      console.log("messageFromOpenai is undefined");
      messageFromOpenai =
        "Sorry, I am not sure what you mean. Please try again.";
    }

    messageFromOpenai = replaceFirstBackticks(messageFromOpenai);

    // if ```python in the messageFromOpenai, then run addComments(messageFromOpenai)

    if (messageFromOpenai.includes("```python")) {
      messageFromOpenai = addComments(messageFromOpenai);
    }

    console.log("messageFromOpenai", messageFromOpenai);

    // check```python and ``` in the messageFromOpenai

    // process the messageFromOpenai based on...
    // check if the messageFromOpenai contains python code.
    // if yes, then add "Do you want to run the code on Aliro?" to the messageFromOpenai in next line
    // if no, then do nothing

    let booleanCode = checkIfCode(messageFromOpenai);

    console.log("booleanCode", booleanCode);

    if (booleanCode) {
      let extractedCodeTemp = extractCode(messageFromOpenai);

      let packagesOfCode = extractPackagesOfCode(extractedCodeTemp);

      let packagesNotInstalled = await checkCodePackages(packagesOfCode);

      console.log("packagesNotInstalled", packagesNotInstalled);

      // make official package names of the packagesNotInstalled using LLM
      // let listOfOfficialPackageName=await doubleCheckPackagesWithLLM(packagesNotInstalled)

      // convert to the official package names
      // let officialPackagesNotInstalled=convertToOfficialPackageName(listOfOfficialPackageName,packagesNotInstalled)

      if (packagesNotInstalled.length > 0) {
        setBooleanPackageInstall(true);

        messageFromOpenai =
          packagesNotInstalled +
          " " +
          "package(s) is (are) not installed." +
          " " +
          "If you want to install the packages to run the below code, please click the button below. Conversely, if you want to modify the code, simply double-click on it, make the necessary changes, and then save by pressing the esc key." +
          "\n" +
          messageFromOpenai;
      } else {
        setBooleanPackageInstall(false);
        messageFromOpenai =
          "If you wish to execute the code on Aliro, please click on the button located below. Conversely, if you want to modify the code, simply double-click on it, make the necessary changes, and then save by pressing the esc key." +
          "\n" +
          messageFromOpenai;
      }

      // function for running the code on aliro
      // runCodeOnAliro(extractedCode);
      setExtractedCode({ ...extractedCode, code: extractedCodeTemp });
    }

    setChatLog((chatLog) => [
      ...chatLog.slice(0, -1),
      {
        user: "gpt",
        message: messageFromOpenai,
        className: "",
      },
    ]);

    await postInChatlogsToDB(
      chatid_list[chatCurrentTempId - 1],
      messageFromOpenai,
      "text",
      "gpt"
    );

    autoScrollDown();

    setLanModelReset(false);
    enableReadingInput();
  }

  // modified handleSubmit to generate code for error handling of running code
  async function submitErrorWithCode(e, code) {
    // prevent page from refreshing
    e.preventDefault();

    // let experimentId = experiment.data._id;

    let chatLogNew = chatLog;

    // chatLogNew = [
    //     ...chatLog, {
    //         user: "me",
    //         message: `${chatInput}`
    //     }
    // ]

    setChatInput("");
    // setChatLog(chatLogNew)

    // GET http://localhost:5080/chatapi/v1/chats/experiment/${experimentId}

    let chatid_list = await savedChatIDs();

    let data = await getChatMessageByExperimentId(
      chatid_list[chatCurrentTempId - 1]
    );

    // filter the data using _experiment_id
    // let filteredData = data.filter(
    //   (item) => item._experiment_id === experimentId
    // );

    let filteredData = data;

    console.log("submitErrorWithCode-filteredData", filteredData);
    // chatLogNew
    console.log("submitErrorWithCode-chatLogNew", chatLogNew);
    // chatCurrentTempId is 1,2,3, ...
    // there is no 0 chatCurrentTempId.
    if (chatCurrentTempId === 0) {
      setChatCurrentTempId(1);
    }

    // if (chatInput !== undefined || chatInput !== ""){
    //     await postInChatlogsToDB(filteredData[chatCurrentTempId-1]['_id'], chatInput, "text", "user");
    // }

    const messages = chatLogNew.map((message) => message.message).join("\n");

    // get the last message from the chatLogNew array
    // in this case, for example, it is "[Errno 2] File theta.csv does not exist: 'theta.csv'"
    let errorMessageFromMachine = chatLogNew[chatLogNew.length - 1].message;

    // let feature_importances = {};
    // for (let i = 0; i < experiment.data.feature_importances.length; i++) {
    //   feature_importances[experiment.data.feature_names[i]] =
    //     experiment.data.feature_importances[i];
    // }

    // my prompt eng
    let preSet = `assume that you already ran the ${code}. However, you got the following error message: ${errorMessageFromMachine}. Please give me another code which does not have the error message. The code should be able to run on Aliro. 
        When the error is related to the missing file, please use the current df as the input. However this does not mean df is csv file or tsv file. df is a variable name. 
        For example, if the error is related to the missing file "theta.csv", please use the current df as the input. Here is another code example. pd.read_csv('path/to/your/csv/file'). This code will cause error because the file does not exist. However, if you change the code to pd.read_csv(df), it will not cause error.
        Please write the code between 3 backticks python and 3backticks. For example, the format is like this: \`\`\`python\nimport pandas as pd\nimport numpy as np\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n\`\`\`
        Please remember that df is already defined. You do not need to load the csv file.
        `;

    let waitingMessage = "Please wait while I am thinking..";

    let typingDelay = 10; // milliseconds per character

    // Before making the API call
    setChatLog((chatLogNew) => [
      ...chatLogNew,
      {
        user: "gpt",
        message: "",
        className: "blinking",
      },
    ]);

    // autoScrollDown();

    // Gradually update the message (waitingMessage) with a delay
    let messageIndex = 0;
    let intervalId = setInterval(() => {
      if (messageIndex < waitingMessage.length) {
        setChatLog((chatLogNew) => [
          ...chatLogNew.slice(0, -1),
          {
            user: "gpt",
            message: waitingMessage.slice(0, messageIndex + 1),
            className: "blinking",
          },
        ]);

        messageIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, typingDelay);

    // await postInChatlogsToDB(
    //   filteredData[chatCurrentTempId - 1]["_id"],
    //   waitingMessage,
    //   "text",
    //   "gpt"
    // );

    await postInChatlogsToDB(
      chatid_list[chatCurrentTempId - 1],
      waitingMessage,
      "text",
      "gpt"
    );

    // makeBlinking();

    console.log("test-preSet", preSet);

    data = await openaiChatCompletions(currentModel, preSet);

    console.log("test-data", data);

    // nomore blinking
    nomoreBlinking();

    let messageFromOpenai = data.choices[0].message["content"];

    // process the messageFromOpenai based on...
    // check if the messageFromOpenai contains python code.
    // if yes, then add "Do you want to run the code on Aliro?" to the messageFromOpenai in next line
    // if no, then do nothing

    let booleanCode = checkIfCode(messageFromOpenai);

    if (booleanCode) {
      let extractedCodeTemp = extractCode(messageFromOpenai);
      let packagesOfCode = extractPackagesOfCode(extractedCodeTemp);

      let packagesNotInstalled = await checkCodePackages(packagesOfCode);

      if (packagesNotInstalled.length > 0) {
        setBooleanPackageInstall(true);

        messageFromOpenai =
          packagesNotInstalled +
          " " +
          "package(s) is (are) not installed!" +
          "\n" +
          +" " +
          "If you want to install the packages to run the below code, please click the button below" +
          "\n" +
          messageFromOpenai;
      }

      // console.log("extractedCodeTemp: ", extractedCodeTemp)
      else {
        setBooleanPackageInstall(false);
        messageFromOpenai =
          "If you wish to execute the code on Aliro, please click on the button located below. Conversely, if you want to modify the code, simply double-click on it, make the necessary changes, and then save by pressing the esc key." +
          "\n" +
          messageFromOpenai;
      }

      // function for running the code on aliro
      // runCodeOnAliro(extractedCode);
      setExtractedCode({ ...extractedCode, code: extractedCodeTemp });
    }

    // setChatLog([
    //     ...chatLogNew, {
    //         user: "gpt",
    //         message: `${data.message}`
    //     }
    // ])

    // const regex = /```([^`]*)```/g;
    // const matches = messageFromOpenai.matchAll(regex);

    // for (const match of matches) {
    //     //check if the first 6 characters are python
    //     if(match[1].substring(0,6) === "python"){
    //         //remove the first 6 characters
    //         match[1] = match[1].substring(6);
    //     }
    //     // console.log("python code:",match[1]);
    // }

    // setChatLog([
    //     ...chatLogNew, {
    //         user: "gpt",
    //         message: `${messageFromOpenai}`
    //         // message: messageFromOpenai.split(/\n/).map(
    //         //     line =>
    //         //     <div key={line}>
    //         //     {line}</div>
    //         // )
    //     }
    // ])

    setChatLog((chatLog) => [
      ...chatLog,
      {
        user: "gpt",
        message: messageFromOpenai,
        className: "",
      },
    ]);

    await postInChatlogsToDB(
      // filteredData[chatCurrentTempId - 1]["_id"],
      chatid_list[chatCurrentTempId - 1],
      messageFromOpenai,
      "text",
      "gpt"
    );

    // await postInChatlogsToDBWithExeId(filteredData[chatCurrentTempId-1]['_id'], messageFromOpenai, "text", "gpt", "");

    autoScrollDown();

    setLanModelReset(false);
  }

  async function showCodeRunningMessageWhenClickRunBtn(e) {
    console.log("star-0. showCodeRunningMessageWhenClickRunBtn");
    // prevent page from refreshing
    e.preventDefault();

    // let experimentId = experiment.data._id;

    let chatLogNew = chatLog;

    // chatLogNew = [
    //     ...chatLog, {
    //         user: "me",
    //         message: `${chatInput}`
    //     }
    // ]

    setChatInput("");
    // setChatLog(chatLogNew)

    // GET http://localhost:5080/chatapi/v1/chats/experiment/${experimentId}

    let chatid_list = await savedChatIDs();

    console.log("iii-chatid_list", chatid_list);

    let data = await getChatMessageByExperimentId(
      // chatCurrentTempId
      chatid_list[chatCurrentTempId - 1]
    );

    // filter the data using _experiment_id
    // let filteredData = data.filter(
    //   (item) => item._experiment_id === experimentId
    // );

    // let filteredData = data;

    // chatCurrentTempId is 1,2,3, ...
    // there is no 0 chatCurrentTempId.
    if (chatCurrentTempId === "") {
      setChatCurrentTempId(1);
    }

    // if (chatInput !== undefined || chatInput !== ""){
    //     await postInChatlogsToDB(filteredData[chatCurrentTempId-1]['_id'], chatInput, "text", "user");
    // }

    // const messages = chatLogNew
    // .map((message) => message.message)
    // .join("\n")

    // get the last message from the chatLogNew array
    // in this case, for example, it is "[Errno 2] File theta.csv does not exist: 'theta.csv'"
    // let errorMessageFromMachine = chatLogNew[chatLogNew.length - 1].message;

    let waitingMessage = "Please wait while I am running your code on Aliro..";
    let typingDelay = 5; // milliseconds per character

    // Before making the API call
    setChatLog((chatLogNew) => [
      ...chatLogNew,
      {
        user: "gpt",
        message: "",
        className: "blinking",
      },
    ]);

    // Gradually update the message (waitingMessage) with a delay
    let messageIndex = 0;
    let intervalId = setInterval(() => {
      if (messageIndex < waitingMessage.length) {
        setChatLog((chatLogNew) => [
          ...chatLogNew.slice(0, -1),
          {
            user: "gpt",
            message: waitingMessage.slice(0, messageIndex + 1),
            className: "blinking",
          },
        ]);
        messageIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, typingDelay);

    console.log(
      "show-chatid_list[chatCurrentTempId - 1]",
      chatid_list[chatCurrentTempId - 1]
    );

    await postInChatlogsToDB(
      // chatCurrentTempId,
      chatid_list[chatCurrentTempId - 1],
      waitingMessage,
      "text",
      "gpt"
    );

    autoScrollDown();
  }

  //current
  async function updateAfterRuningCode(e, resp) {
    console.log("star-2. updateAfterRuningCode");

    console.log("updateAfterRuningCode-resp['result']", resp["result"]);

    console.log("updateAfterRuningCode-resp", resp);

    console.log(
      "updateAfterRuningCode-resp['dataset_file_id']",
      resp["_dataset_file_id"]
    );

    console.log("updateAfterRuningCode-resp['files']", resp["files"]);

    console.log(
      "updateAfterRuningCode-resp['files'].length",
      resp["files"].length
    );

    // prevent page from refreshing
    e.preventDefault();

    let resultMessage = resp["result"];

    // if resultMessage is undefined, resultMessage = "Undefined"

    // let experimentId = experiment.data._id;

    // let chatLogNew =[
    //     {
    //         user: "gpt",
    //         message: "How can I help you today?"
    //     }
    // ]

    let chatLogNew = [];

    // chatLogNew = [
    //     ...chatLog, {
    //         user: "me",
    //         message: `${chatInput}`
    //     }
    // ]

    // setChatInput("");
    // setChatLog(chatLogNew)

    // GET http://localhost:5080/chatapi/v1/chats/experiment/${experimentId}
    let chatid_list = await savedChatIDs();
    let data = await getChatMessageByExperimentId(
      chatid_list[chatCurrentTempId - 1]
    );

    console.log("12-data", data);

    // filter the data using _experiment_id
    // let filteredData = data.filter(
    //   (item) => item._experiment_id === experimentId
    // );

    let filteredData = data;

    // chatCurrentTempId is 1,2,3, ...
    // there is no 0 chatCurrentTempId.
    if (chatCurrentTempId === 0) {
      setChatCurrentTempId(1);
    }

    // test
    const messages = chatLogNew.map((message) => message.message).join("\n");

    console.log("resp[_id]", resp["_id"]);

    // let chatid_list = await savedChatIDs();

    await postInChatlogsToDBWithExeId(
      // filteredData[chatCurrentTempId - 1]["_id"],
      chatid_list[chatCurrentTempId - 1],
      resultMessage,
      "text",
      "gpt",
      resp["_id"]
    );

    setChatLog((chatLog) => [
      ...chatLog,
      {
        user: "gpt",
        execution_id: resp["_id"],
        message: resultMessage,
      },
    ]);

    autoScrollDown();

    // setLanModelReset(false);
  }

  function handleTemp(temp) {
    if (temp > 1) {
      setTemperature(1);
    } else if (temp < 0) {
      setTemperature(0);
    } else {
      setTemperature(temp);
    }
  }

  async function setTapTitlesFunc() {
    let tempTapTitles = [];
    // let chatid_list = await savedChatIDs();

    // console.log("setTapTitlesFunc-chatid_list-in");

    // console.log("setTapTitlesFunc-chatid_list", chatid_list);

    // let index = 0;
    // tempTapTitles = await Promise.all(
    //   chatid_list.map(async (chatid) => {
    //     let data = await getSpecificChatbyChatId(chatid);

    //     index++;

    //     if (data["chat"]["title"] === undefined) {
    //       return "ChatTap";
    //     } else {
    //       return data["chat"]["title"];
    //     }
    //   })
    // );

    tempTapTitles = ["Chat Tap"];

    // console.log("setTapTitlesFunc-tempTapTitles", tempTapTitles);

    setTapTitles({ ...tapTitles, taptitles: tempTapTitles });
  }

  // function checkStatus(response) {
  //   console.log("checkStatus-response", response);
  //   if (response.status >= 400) {
  //     //console.log(`error: ${response.error}`)
  //     let error = new Error(
  //       `${response.status}: ${response.statusText} : ${response.url}`
  //     );
  //     error.response = response;
  //     throw error;
  //   } else {
  //     return response;
  //   }
  // }

  function disableReadingInput() {
    // make submit button disabled
    let submitButton = document.getElementsByClassName("submit")[0];
    //   console.log("submitButton", submitButton)
    submitButton.disabled = true;

    //   document.querySelector(".submit").disabled = false;

    // make chat-input-textareaForGOT disabled
    let chatInputTextarea = document.getElementsByClassName(
      "chat-input-textarea"
    )[0];
    // console.log("chat-input-textarea", chat-input-textareaForGOT)
    chatInputTextarea.disabled = true;
  }

  function enableReadingInput() {
    let submitButton = document.getElementsByClassName("submit")[0];
    // make submit button abled
    submitButton.disabled = false;

    let chatInputTextarea = document.getElementsByClassName(
      "chat-input-textarea"
    )[0];
    //  // make chatInputTextarea abled
    chatInputTextarea.disabled = false;
  }

  function autoScrollDown() {
    let scrollToTheBottomChatLog = document.getElementById("chatgpt-space");
    console.log("scrollToTheBottomChatLog", scrollToTheBottomChatLog);
    scrollToTheBottomChatLog.scrollTop = scrollToTheBottomChatLog.scrollHeight;
  }

  // let datasetId = experiment.data._dataset_id;
  // let experimentId = experiment.data._id;

  // temp
  // let datasetId = "5f9b3b3b9d9d975b3c3e3b3b";
  // let experimentId = "5f9b3b3b9d9d975b3c3e3b3b";

  return (
    <div className="ChatGPTForGOT">
      {/* <div>
        <textarea
          onChange={handleInputChange}
          value={inputText}
          placeholder="Enter your code..."
        ></textarea>
        <button onClick={generateCode}>Generate Code</button>
        <div>
          <strong>Generated Code:</strong>
          <pre>{generatedCode}</pre>
        </div>
      </div> */}
      {
        <AllContext.Provider
          value={{
            currentModel,
            setCurrentModel,
            models,
            handleTemp,
            temperature,
            clearChat,
            chatLog,
            setChatLog,
            chatCurrentTempId,
            setChatCurrentTempId,
            numChatBox,
            setNumChatBox,
            lanModelReset,
            setLanModelReset,
            limitNumChatBox,
            currentExpId,
            setCurrentExpId,
            tapTitles,
            setTapTitles,
            setTapTitlesFunc,
            getChatMessageByExperimentId,
            getSpecificChatbyChatId,
            getAllChatsFromDB,
            postChats,
            postInChatlogsToDB,
            deleteSpecificChat,
            patchSpecificChat,
            experiment,
            setTemperature,
            preSetPrompt,
            setPreSetPrompt,
            savedChatIDs,
            current_chatTapID,
            setCurrent_chatTapID,
            createChatID,
          }}
        >
          {/* <SideMenu /> */}
        </AllContext.Provider>
      }

      <AllContext.Provider
        value={{
          chatInput,
          chatLog,
          setChatInput,
          handleSubmit,
          modeForChatOrCodeRunning,
          setModeForChatOrCodeRunning,
          // datasetId,
          // experimentId,
          updateAfterRuningCode,
          modeForTabluerData,
          setModeForTabluerData,
          booleanPackageInstall,
          setBooleanPackageInstall,
          submitErrorWithCode,
          showCodeRunningMessageWhenClickRunBtn,
          getChatMessageByExperimentId,
          chatCurrentTempId,
          getSpecificChatbyChatId,
          patchChatToDB,
          checkCodePackages,
          disableReadingInput,
          enableReadingInput,
          autoScrollDown,
          nomoreBlinking,
          makeBlinking,
          savedChatIDs,
          handleSubmitFromEditor,
          handleSubmitForAudioToText,
          readyToDisplayGOT,
          setReadyToDisplayGOT,
        }}
      >
        <ChatBox />
        {/* <div id="dispnetgra" className={"show-contents"}>
          <DisplayGraph />
        </div> */}
      </AllContext.Provider>

      {/* <ThemeContext.Provider value={{isDark, setIsDark, currentModel,setCurrentModel,experimentId}}>
                <TestPage/>
            </ThemeContext.Provider> */}
    </div>
  );
}