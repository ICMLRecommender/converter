const moment = require('moment-timezone');
moment.tz.setDefault('America/Los_Angeles');

// ----------------------------------------------------------------------------
// CONSTANTS


// ----------------------------------------------------------------------------
// FUNCTIONS

function generatePeople(authorsDb) {
    return loadOriginalAuthors(authorsDb)
        .then(transformAuthors)
}

function transformAuthors(authors) {
    let people = {};
    
    for(let i = 0, n = authors.length; i < n; ++i) {
        let author = transformAuthor(authors[i].doc);
        people[author.id] = author;
    }

    return Promise.resolve(people);
}

function transformAuthor(oldAuthor) {
    var newAuthor = {};
    newAuthor.id = oldAuthor.author_id;
    newAuthor.name = oldAuthor.author;
    newAuthor.institution = oldAuthor.affiliation;
    newAuthor.paper_ids = oldAuthor.paper_ids;
    newAuthor.bio = oldAuthor.bio;

    return newAuthor;
}

function loadOriginalAuthors(authorsDb) {
    return authorsDb.allDocs({
        include_docs: true,
        attachments: true
    }).then((result) => {
        return Promise.resolve(result.rows);
    });
}

// ----------------------------------------------------------------------------
// EXPORTS

module.exports = {
    generatePeople: generatePeople,
};