const moment = require('moment-timezone');
moment.tz.setDefault('America/Los_Angeles');

// ----------------------------------------------------------------------------
// CONSTANTS

const roomOrder = [ 
    'Hall A',
    'Hall C',
    'Grand Ballroom',
    'Beverly Theater',
    'Pacific Ballroom',
    'Pacific Ballroom Concourse',
    'Grand Ballroom A',
    'Grand Ballroom B',
    'Seaside Ballroom',
    'Hyatt Seaview Ballroom',
    'Hyatt Regency Ballroom A+B+C',
    'Hyatt Beacon Ballroom D+E+F+H',
    'Hyatt Shoreline',
    'S-1',
    'S-3',
    'S-4',
    'S-5',
    'S-7',
    '102 A+B',
    '103 A+B',
    '101-A',
    '101-B',
    '102-C',
    '103-C',
    '104-A',
    '104-B',
    '104-C',
    '201-A',
    '201-B',
    '202',
    '203',
    '204',
    'undefined'
];

// ----------------------------------------------------------------------------
// FUNCTIONS

function populateSessionMapping(sessions) {
    let sessionIdToIndexMapping = {}
    // create a sesiionid to index mapping sessionIdToIndexMapping
    for(let dayIndex=0; dayIndex<sessions.length; ++dayIndex) {
        let timeslots = sessions[dayIndex];
        for (let timeslotIndex=0; timeslotIndex < timeslots.length; ++timeslotIndex) {
            let subtimeslots = timeslots[timeslotIndex];
            for (let subtimeslotIndex=0; subtimeslotIndex < subtimeslots.length; ++subtimeslotIndex) {
                let sessionsInThisSubTimeSlot = subtimeslots[subtimeslotIndex];
                if(sessionsInThisSubTimeSlot == undefined) {
                    var fdgd = 4;
                }
                for(let h=0; h < sessionsInThisSubTimeSlot.length; ++h) {
                    let t_session = sessionsInThisSubTimeSlot[h];
                    let t_session_id = t_session.session_id;
                    sessionIdToIndexMapping[t_session_id] = {"dayIndex" : dayIndex, "timeslotIndex": timeslotIndex, "subtimeslotIndex":subtimeslotIndex, "sub_index": h};
                }
            }
        }
    }

    return Promise.resolve(sessionIdToIndexMapping);
}

function groupSchedule(sessions) {
    return Promise.resolve(sessions.map((day) => {
        return day.map((group) => {
            let newGroup = [];
            let currentType = undefined;
            let currentSubGroup = undefined;

            for(let i = 0, n = group.length; i < n; ++i) {
                let session = group[i];
                
                if((currentType == undefined) || (currentType == 'break' && session.type_code != 'break') || (currentType != 'break' && session.type_code == 'break')) {
                    currentSubGroup = [];
                    newGroup.push(currentSubGroup);
                    currentType = (session.type_code == 'break')? 'break':'other';
                }
                currentSubGroup.push(session);
            }

            return newGroup;
        });
    }));
}

function simplifySchedule(sessions) {
    return Promise.resolve(sessions.map((day) => {
        let newGroups = [];
        let currentTime = undefined;
        let currentGroup = undefined;
        let currentType = undefined;

        // we push the first group
        currentGroup = day[0];
        newGroups.push(currentGroup);
        currentTime = moment(currentGroup[0].session_time);
        currentType = currentGroup[0].type_code;

        for(let j = 1, m = day.length; j < m; ++j) {
            let group = day[j];
            let time = moment(group[0].session_time);
            let type = group[0].type_code;
            let diff = time.diff(currentTime, 'minute');
            if((type == 'break' && group.length == 1) || (currentType == 'break' && currentGroup.length == 1) || (!isSplitedType(type, currentType) && (diff < 60))) {
                for(let i = 0, n = group.length; i < n; ++i) {
                    currentGroup.push(group[i]);
                }
            }
            else {
                newGroups.push(group);
                currentGroup = group;
            }
            currentTime = time;
            if(type != 'break') {
                currentType = type;
            }
        }

        return newGroups;
    }));
}

function isSplitedType(a, b) {
    if((a == 'oral') || (a == 'spotlight')) {
        if((b == 'oral') || (b == 'spotlight')) {
            return false;
        }
    }
    
    if((a == 'demonstration') || (a == 'poster')) {
        if((b == 'demonstration') || (b == 'poster')) {
            return false;
        }
    }

    return a != b;
}


function groupSessionsByStart(all) {
    return Promise.resolve(all.map((sessions, day) => {
        let groups = [];
        let currentTime = undefined;
        let currentGroup = undefined;

        for(let i = 0, n = sessions.length; i < n; ++i) {
            let time = moment(sessions[i].session_time, 'YYYY-MM-DD HH:mm:SS');
            let hour = time.format('hh:mm A');
            if((currentTime === undefined) || (currentTime != hour)) {
                currentGroup = [];
                groups.push(currentGroup);
                currentTime = hour;
            }
            currentGroup.push(sessions[i]);
        }

        return groups;
    }));
}

function populateDaylyShedule(sessions) {
    let dailySchedule = [];
    for(let i = 0, n = sessions.length; i < n; ++i) {
        let groups = sessions[i];
        let day = {slots:[]};
        for(let j = 0, m = groups.length; j < m; ++j) {
            let time = moment(groups[j][0][0].session_time);
            let hour = time.format("hh:mm A");

            if(j == 0) {
                day.dayString = time.format("ddd");
            }
            day.slots.push(hour);
        }

        dailySchedule.push(day);
    }

    // console.log("'DAILY SCHEDULE: ", dailySchedule);

    return Promise.resolve(dailySchedule);
}

function splitSessionsByDays(sessions) {
    let days = [];
    let currentDay = undefined;
    let currentSlots = undefined;

    for(let i = 0, n = sessions.length; i < n; ++i) {
        let time = moment(sessions[i].session_time, 'YYYY-MM-DD HH:mm:SS');
        let day = time.date();
        if((currentDay === undefined) || (currentDay != day)) {
            currentDay = day;
            currentSlots = [];
            days.push(currentSlots);
        }
        currentSlots.push(sessions[i]);
    }

    return Promise.resolve(days);
}

function enrichSessions(sessionDocs) {
    //console.log('Session docs: ', sessionDocs.length);
    let types = {};

    let sessions = [];
    for(let i = 0, n = sessionDocs.length; i < n; ++i) {
        let session = sessionDocs[i].doc;

        // --- room correction
        if(session.session_location == '-204') {
            session.session_location = "204";
        }
        
        // --- type
        // if(!types.includes(session.type)) {
        //     types.push(session.type);
        // }
        session.type_code = session.type.toLowerCase().replace(" ", "_");
        if(session.type_code.startsWith('invited_talk')) {
            session.type_code = 'invited_talk';
        }
        types[session.type_code] = true;

        sessions.push(session);
    }

    console.log("All types: ", Object.keys(types));

    return Promise.resolve(sessions);
}

function sessionSorter(a, b) {
    let diff = new Date(a.session_time).getTime() - new Date(b.session_time).getTime();
    if(diff == 0) {
        return getRoomOrder(a.session_location) - getRoomOrder(b.session_location);
    }
    else {
        return diff;
    }
}

function getRoomOrder(room) {
    if(room == undefined) {
        room = "undefined";
    }
    return roomOrder.indexOf(room);
}

function loadOriginalSchedule(sessionsDb) {
    return sessionsDb.allDocs({
        include_docs: true,
        attachments: true
    }).then((result) => {
        // allSessionDocs = result.rows;

        return Promise.resolve(result.rows);
    });
}

// ----------------------------------------------------------------------------
// EXPORTS

module.exports = {
    populateSessionMapping: populateSessionMapping,
    groupSchedule: groupSchedule,
    simplifySchedule: simplifySchedule,
    isSplitedType: isSplitedType,
    groupSessionsByStart: groupSessionsByStart,
    populateDaylyShedule: populateDaylyShedule,
    splitSessionsByDays: splitSessionsByDays,
    enrichSessions: enrichSessions,
    sessionSorter: sessionSorter,
    getRoomOrder: getRoomOrder,
    loadOriginalSchedule: loadOriginalSchedule
};