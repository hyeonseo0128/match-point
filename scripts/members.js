const members = [];

function addMember(name) {
    if (name) {
        members.push(name);
        displayMembers();
    } else {
        alert("Please enter a member name.");
    }
}

function removeMember(name) {
    const index = members.indexOf(name);
    if (index > -1) {
        members.splice(index, 1);
        displayMembers();
    } else {
        alert("Member not found.");
    }
}

function displayMembers() {
    const memberList = document.getElementById("member-list");
    memberList.innerHTML = "";
    members.forEach(member => {
        const li = document.createElement("li");
        li.textContent = member;
        memberList.appendChild(li);
    });
}

document.getElementById("add-member-form").addEventListener("submit", function(event) {
    event.preventDefault();
    const memberName = document.getElementById("member-name").value;
    addMember(memberName);
    document.getElementById("member-name").value = "";
});