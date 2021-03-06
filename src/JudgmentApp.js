// respObj imported from php
//   respIds responses cDefinitions cTitles sContent sTitle

const { Component } = wp.element;
//import './judgmentapp.scss';
import PresentContext from './PresentContext';
import PresentResp from './PresentResp';
import Rationale from './Rationale';
import Confirm from './Confirm';
import ShowEnd from './ShowEnd';
import ShowReview from './ShowReview';
import Mismatches from './Mismatches';

const review = respObj.review == 'true';
const nTrials = respObj.respIds.length;

class JudgmentApp extends Component {
    // Tracks various attributes and their changes as the user moves through the trials
    startDate = Date.now();  // UNIX time on page load
    state = {
        trial: 1,   // Each judgment is one trial
        respId: respObj.respIds[0],   // The ID of the Response being judged
        choice: null,   // Text of the user's judgment
        choiceNum: 0,   // Number of the user's judgment
        startTime: Math.floor(this.startDate / 1000),    // UNIX time on page load, in seconds
        judgTime: 0,    // Time from page load to judgment made, in seconds
        allDone: false, // Whether the 'ShowEnd' component should be displayed
        rationale: null, // The user's rationale for the current trial
        showMatches: review,  // display total number matches
        conVisible: false   // Whether the component 'Confirm' should be displayed
    };
    // Labels for Response judgments
    levelTitles = {
        1: "Less Skilled",
        2: "Proficient",
        3: "Master"
    };

    /**
     * handleChoice: calculates judg_time, updates state
     * Parameters: optionNum, the numerical value of the judgment; option, the text value
     * Fires: when the user clicks a 'judgment' button
     */
    handleChoice = (optionNum, option) => {
        // Calculate time from task load to option selected
        const endDate = Date.now();
        const endTime = Math.floor(endDate / 1000);
        const judgTime = endTime - this.state.startTime;

        // Update state
        this.setState(() => ({
            choice: option,
            choiceNum: optionNum,
            judgTime: judgTime
        }));
        if(review) {
            this.setState(() => ({
                conVisible: true
            }));
        }
    }

    handleRationale = (rationale) => {
        // Verify rationale
        if (!rationale) {
            return "Enter a valid rationale";
        }
        const wordRat = rationale.split(" ");
        if (wordRat.length > 125) {
            return "Trim your rationale down to 125 words";
        }
        this.setState(() => ({
            rationale: rationale,
            conVisible: true
        }));
    }

    handleRevise = () => {
        this.setState(() => ({conVisible:false}));
        var dataObj = {
            sub_num: respObj.subNums[this.state.trial-1],
            comp_num: respObj.compNum,
            task_num: respObj.taskNum,
            resp_id: this.state.respId,
            judg_type: review ? 'rev' : 'ind',
            judg_level: this.state.choiceNum,
            judg_time: this.state.judgTime,
            rationale: this.state.rationale
        };

        // Save to DB
        this.saveData(dataObj);

        // Set new start time
        const newStartDate = Date.now();
        const newStartTime = Math.floor(newStartDate / 1000);
        this.setState(() => ({startTime: newStartTime}));
    }
    
    /**
     * handleNext: checks whether the user is finished with the current set, saves the current line to
     *      the database, and sets the new startTime
     * Parameters: none
     * Fires: when the user clicks the 'Next' button
     */
    handleNext = () => {
        // Check whether the user has finished all the trials
        if (this.state.trial < nTrials) {
            this.setState((prevState) => ({
                trial: prevState.trial + 1,
                conVisible: false
            }),
            this.getCase
            );
        } else {
            this.setState(() => ({
                allDone: true
            }));
        }

        var dataObj = {
            sub_num: respObj.subNums[this.state.trial-1],
            comp_num: respObj.compNum,
            task_num: respObj.taskNum,
            resp_id: this.state.respId,
            judg_type: review ? 'rev' : 'ind',
            judg_level: this.state.choiceNum,
            judg_time: this.state.judgTime,
            rationale: this.state.rationale
        };

        // Save to DB
        this.saveData(dataObj);
        // Check if there's anything in localStorage - if yes, try to push to DB
        if(localStorage.length != 0) {
            var keys = Object.keys(localStorage);
            keys.forEach((key) => {
                if(localStorage.getItem(key)!=null && localStorage.getItem(key)!=undefined && localStorage.getItem(key)!="") {
                    var localObj = JSON.parse(localStorage.getItem(key));
                    localObj._ajax_nonce = respObj.nonce;
                    // Save to DB
                    this.saveData(localObj,key); 
                } else {
                    console.log(typeof key);
                }   
            } );
        }

        // Set new start time
        const newStartDate = Date.now();
        const newStartTime = Math.floor(newStartDate / 1000);
        this.setState(() => ({startTime: newStartTime}));
    }
    
    /**
     * getCase: gets the new Response ID
     * Parameters: none
     * Fires: inside handleNext
     */
    getCase = () => {
        this.setState(() => ({
            respId: respObj.respIds[this.state.trial - 1]
        }));
    }
    
    /**
     * componentDidUpdate: scrolls the webpage so that 'rationale' is in view
     * Parameters: none
     * Fires: after the component changes
     */
    componentDidUpdate = () => {
        if ( document.getElementById("rationale") ) {
            const elDiv = document.getElementById("rationale");
            elDiv.scrollIntoView();
        }
    }

    saveData = (dataObj,key = null) => {
        dataObj.action = 'arc_save_data';
        dataObj._ajax_nonce = respObj.nonce;

        jQuery.ajax({
            type : 'post',
            dataType: 'json',
            url : respObj.ajax_url,
            data : dataObj,
            error : function( response ) {
                console.log("something went wrong (error case)");
                // save to localStorage
                localStorage.setItem(JSON.stringify(dataObj.resp_id),JSON.stringify(dataObj));
            },
            success : function( response ) {
                if( response.type == 'success' && dataObj.sub_num == response.data.sub_num) {
                    console.log('success!');
                    if(key) {
                        localStorage.removeItem(key);
                    }
                } else {
                    console.log("something went wrong");
                    // save to localStorage
                    localStorage.setItem(JSON.stringify(dataObj.resp_id),JSON.stringify(dataObj));
                }
            }
        });
    }

    /**
     * Determines whether to save the matched cases, lets the user move on to reviewing disagreements.
     */
    saveMatches = (saveBool) => {
        // if the user wants to save, make an ajax request to save the matched cases
        // if(saveBool) {
        //     console.log('sending request...');
        //     respObj.matches.forEach((match) => this.saveData(match));
        // }

        // move on to reviewing disagreements
        this.setState(() => ({
            showMatches: false
        }));
    }

    /**
     * Renders the components for JudgmentApp
     */
    render() {
        return (
            <div>
                { this.state.allDone && <ShowEnd />}
                {(!this.state.allDone && this.state.showMatches) &&
                    <Mismatches
                        disagreements={respObj.disagreements}
                        total={respObj.total}
                        saveMatches={this.saveMatches}
                    />
                }
                {(!this.state.allDone && !this.state.showMatches) &&
                    <PresentContext 
                        scenario={respObj.sContent}
                        competencies={respObj.cDefinitions}
                        levelTitles={this.levelTitles}
                        sTitle={respObj.sTitle}
                        cTitle={respObj.cTitles[0]}
                    />
                }
                { (!this.state.allDone && !this.state.showMatches) &&
                    <PresentResp
                        respId={ this.state.respId }
                        response={ respObj.responses[this.state.respId] }
                    />
                }
                {(!this.state.allDone && review && !this.state.showMatches) &&
                    <ShowReview 
                        subNum={respObj.subNums[this.state.trial-1]}
                        reviewSet={respObj.reviewSet}
                        handleChoice={this.handleChoice}
                        levelTitles={this.levelTitles}
                        conVisible={this.state.conVisible}
                    />
                }
                {(!this.state.allDone && this.state.conVisible) &&
                    <Confirm
                        choice={this.state.choice}
                        rationale={this.state.rationale}
                        handleRevise={this.handleRevise}
                        handleNext={this.handleNext}
                        showRat={!review}
                    />
                }
                {(!review && (!this.state.allDone && !this.state.conVisible)) &&
                    <Rationale
                        levelTitles={this.levelTitles}
                        handleRationale={this.handleRationale}
                        handleChoice={this.handleChoice}
                    />
                }
            </div>
        );
    }
}

export default JudgmentApp;