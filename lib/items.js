const moment = require('moment-timezone');
moment.tz.setDefault('America/Los_Angeles');

// ----------------------------------------------------------------------------
// CONSTANTS


// ----------------------------------------------------------------------------
// FUNCTIONS

function generateItems(itemsDb) {
    return loadOriginalItems(itemsDb)
        .then(transformItems)
        .then(items => {
            let orderedItems = {};

            for(let i = 0, n = items.length; i < n; ++i) {
                orderedItems[items[i].id] = items[i];
            }

            return Promise.resolve(orderedItems);
        });
}

function transformItems(oldItems) {
    let items = oldItems.map((item) => {
        return transformItem(item.doc);
    });

    return Promise.resolve(items);
}

function transformItem(oldItem) {
    var newItem = {};
    newItem.id = oldItem.paper_id;
    newItem.title = oldItem.title;
    newItem.description = oldItem.abstract;
    //newItem.pdf_url = oldItem.pdf_url;
    newItem.paper_url = oldItem.paper_url;
    newItem.poster_url = oldItem.poster_url;
    newItem.code_url = oldItem.code_url;
    newItem.video_url = oldItem.video_url;
    newItem.session_labels = oldItem.subject_labels;

    if(oldItem.poster_schedule != null && oldItem.poster_schedule != undefined && oldItem.poster_schedule.length == 1) {
        newItem.poster_session = oldItem.poster_schedule[0];
    }
    if(oldItem.oral_schedule != null && oldItem.oral_schedule != undefined && oldItem.oral_schedule.length == 1) {
        newItem.oral_session = oldItem.oral_schedule[0];
    }
    if(oldItem.spotlight_schedule != null && oldItem.spotlight_schedule != undefined && oldItem.spotlight_schedule.length == 1) {
        newItem.spotlight_session = oldItem.spotlight_schedule[0];
    }

    if(Array.isArray(oldItem.authors)) {
        newItem.authors = oldItem.authors;
    }
    else {
        newItem.authors = [];
    }
    // if(oldItem.authors != undefined && oldItem.authors != null) {
    //     // newItem.authorsString = oldItem.authors.map(author => {
    //     //     return author.author;
    //     // }).join(', ');
    //     newItem.authorIds = oldItem.authors.map(author => {
    //         return author.author_id;
    //     });
    // }
    // else {
    //     newItem.authorsString = "";
    // }


    return newItem;
}

function loadOriginalItems(itemsDb) {
    return itemsDb.allDocs({
        include_docs: true,
        attachments: true
    }).then((result) => {
        return Promise.resolve(result.rows);
    });
}
    
// ----------------------------------------------------------------------------
// EXPORTS

module.exports = {
    loadOriginalItems: loadOriginalItems,
    generateItems: generateItems,
};
