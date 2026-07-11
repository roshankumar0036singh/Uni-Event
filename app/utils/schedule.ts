export interface ClassSchedule {
    startAt: string | Date;
    endAt: string | Date;
}

export const hasScheduleOverlap = (
    eventStart: Date,
    eventEnd: Date,
    schedule: ClassSchedule[],
): boolean => {
    return schedule.some(classItem => {
        const classStart = new Date(classItem.startAt);
        const classEnd = new Date(classItem.endAt);
        return eventStart < classEnd && eventEnd > classStart;
    });
};
