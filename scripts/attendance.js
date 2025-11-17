const attendanceRecords = [];

function markAttendance(memberId, gameId) {
    const record = {
        memberId: memberId,
        gameId: gameId,
        date: new Date().toISOString().split('T')[0]
    };
    attendanceRecords.push(record);
    console.log(`Attendance marked for Member ID: ${memberId} at Game ID: ${gameId}`);
}

function getAttendanceByGame(gameId) {
    return attendanceRecords.filter(record => record.gameId === gameId);
}

function getAttendanceByMember(memberId) {
    return attendanceRecords.filter(record => record.memberId === memberId);
}

function displayAttendance(gameId) {
    const records = getAttendanceByGame(gameId);
    if (records.length === 0) {
        console.log(`No attendance records for Game ID: ${gameId}`);
        return;
    }
    console.log(`Attendance for Game ID: ${gameId}`);
    records.forEach(record => {
        console.log(`Member ID: ${record.memberId}, Date: ${record.date}`);
    });
}

// Example usage
// markAttendance(1, 101);
// displayAttendance(101);