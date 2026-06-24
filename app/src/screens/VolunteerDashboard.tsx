import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ScreenWrapper from '../components/ScreenWrapper';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

const PRIORITY_COLORS = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#EF4444',
} as const;

const TABLET_BREAKPOINT = 768;
const DRAG_THRESHOLD = 80;
const SCALE_ACTIVE = 1.05;
const OPACITY_ACTIVE = 0.9;
const MAX_COLUMN_WIDTH = 280;
const COLUMN_WIDTH_RATIO = 0.75;

type TaskStatus = 'todo' | 'in_progress' | 'done';
type Priority = 'low' | 'medium' | 'high';

interface VolunteerTask {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignee?: string;
    priority: Priority;
    createdAt: string;
    eventId?: string;
    eventName?: string;
}

interface Column {
    id: TaskStatus;
    title: string;
    icon: string;
    color: string;
}

const COLUMNS: Column[] = [
    { id: 'todo', title: 'To Do', icon: 'clipboard-outline', color: '#FF6B35' },
    { id: 'in_progress', title: 'In Progress', icon: 'time-outline', color: '#F59E0B' },
    { id: 'done', title: 'Done', icon: 'checkmark-circle-outline', color: '#10B981' },
];

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
    StyleSheet.create({
        gestureHandlerRoot: {
            flex: 1,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 10,
            marginBottom: 16,
        },
        headerTitle: {
            fontSize: 24,
            fontWeight: '800',
            color: theme.colors.text,
        },
        headerSubtitle: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            marginTop: 2,
        },
        addBtn: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows?.small,
        },
        loadingContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        loadingText: {
            fontSize: 16,
            fontWeight: '600',
        },
        boardContainer: {
            paddingBottom: 100,
        },
        column: {
            marginRight: 12,
            backgroundColor: theme.colors.background + '80',
            borderRadius: 16,
            padding: 12,
            maxHeight: '85%',
        },
        columnHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            borderLeftWidth: 3,
            paddingLeft: 10,
        },
        columnIconContainer: {
            width: 32,
            height: 32,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
        },
        columnTitle: {
            fontSize: 15,
            fontWeight: '700',
            flex: 1,
        },
        columnCount: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
        },
        columnCountText: {
            fontSize: 12,
            fontWeight: '700',
        },
        taskList: {
            flex: 1,
        },
        taskListContent: {
            gap: 10,
            paddingBottom: 8,
        },
        emptyColumn: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 40,
            gap: 8,
        },
        emptyColumnText: {
            fontSize: 13,
            fontWeight: '500',
        },
        taskCard: {
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            ...theme.shadows?.small,
        },
        taskHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        priorityBadge: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
        },
        priorityText: {
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 0.5,
        },
        taskTitle: {
            fontSize: 14,
            fontWeight: '700',
            marginBottom: 4,
            lineHeight: 20,
        },
        taskDescription: {
            fontSize: 12,
            lineHeight: 16,
            marginBottom: 8,
        },
        taskFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
        },
        eventTag: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 4,
            flex: 1,
        },
        eventTagText: {
            fontSize: 10,
            fontWeight: '600',
        },
        assigneeContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        assigneeAvatar: {
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        assigneeInitial: {
            fontSize: 11,
            fontWeight: '700',
        },
        swipeHint: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        swipeHintText: {
            fontSize: 10,
            fontWeight: '500',
        },
        modalOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        modalContent: {
            width: '100%',
            maxWidth: 400,
            borderRadius: 20,
            padding: 24,
            ...theme.shadows?.large,
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: '800',
        },
        formGroup: {
            marginBottom: 16,
        },
        formLabel: {
            fontSize: 13,
            fontWeight: '600',
            marginBottom: 6,
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
        },
        textArea: {
            alignItems: 'flex-start',
            minHeight: 80,
        },
        inputWrapper: {
            flex: 1,
        },
        inputText: {
            fontSize: 14,
        },
        priorityRow: {
            flexDirection: 'row',
            gap: 8,
        },
        priorityOption: {
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 10,
            borderWidth: 1.5,
        },
        priorityOptionText: {
            fontSize: 13,
            fontWeight: '600',
        },
        modalActions: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 8,
        },
        modalBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
        },
        modalBtnText: {
            fontSize: 15,
            fontWeight: '700',
        },
    });

interface ReadonlyTaskCardProps {
    readonly task: VolunteerTask;
    readonly onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
    readonly onDeleteTask: (taskId: string) => void;
    readonly columnColor: string;
}

function TaskCard({ task, onMoveTask, onDeleteTask, columnColor }: ReadonlyTaskCardProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);
    const pan = useRef(new Animated.ValueXY()).current;
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                Animated.spring(scale, {
                    toValue: SCALE_ACTIVE,
                    useNativeDriver: false,
                }).start();
                Animated.spring(opacity, {
                    toValue: OPACITY_ACTIVE,
                    useNativeDriver: false,
                }).start();
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
                useNativeDriver: false,
            }),
            onPanResponderRelease: (_e, gesture) => {
                Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
                Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
                Animated.spring(opacity, { toValue: 1, useNativeDriver: false }).start();

                if (gesture.dy < -DRAG_THRESHOLD && task.status !== 'done') {
                    const nextStatus: Record<TaskStatus, TaskStatus> = {
                        todo: 'in_progress',
                        in_progress: 'done',
                        done: 'done',
                    };
                    onMoveTask(task.id, nextStatus[task.status]);
                } else if (gesture.dy > DRAG_THRESHOLD && task.status !== 'todo') {
                    const prevStatus: Record<TaskStatus, TaskStatus> = {
                        todo: 'todo',
                        in_progress: 'todo',
                        done: 'in_progress',
                    };
                    onMoveTask(task.id, prevStatus[task.status]);
                }
            },
        }),
    ).current;

    return (
        <Animated.View
            style={[
                styles.taskCard,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
                    opacity,
                },
            ]}
            {...panResponder.panHandlers}
        >
            <View style={styles.taskHeader}>
                <View
                    style={[
                        styles.priorityBadge,
                        { backgroundColor: PRIORITY_COLORS[task.priority] + '20' },
                    ]}
                >
                    <Text style={[styles.priorityText, { color: PRIORITY_COLORS[task.priority] }]}>
                        {task.priority.toUpperCase()}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => onDeleteTask(task.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <Text style={[styles.taskTitle, { color: theme.colors.text }]} numberOfLines={2}>
                {task.title}
            </Text>

            {task.description ? (
                <Text
                    style={[styles.taskDescription, { color: theme.colors.textSecondary }]}
                    numberOfLines={2}
                >
                    {task.description}
                </Text>
            ) : null}

            <View style={styles.taskFooter}>
                {task.eventName ? (
                    <View style={[styles.eventTag, { backgroundColor: columnColor + '15' }]}>
                        <Ionicons name="calendar-outline" size={10} color={columnColor} />
                        <Text
                            style={[styles.eventTagText, { color: columnColor }]}
                            numberOfLines={1}
                        >
                            {task.eventName}
                        </Text>
                    </View>
                ) : null}
                {task.assignee ? (
                    <View style={styles.assigneeContainer}>
                        <View
                            style={[styles.assigneeAvatar, { backgroundColor: columnColor + '30' }]}
                        >
                            <Text style={[styles.assigneeInitial, { color: columnColor }]}>
                                {task.assignee.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    </View>
                ) : null}
            </View>

            <View style={styles.swipeHint}>
                <Ionicons name="reorder-two-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.swipeHintText, { color: theme.colors.textSecondary }]}>
                    Drag to move
                </Text>
            </View>
        </Animated.View>
    );
}

interface ReadonlyKanbanColumnProps {
    readonly column: Column;
    readonly tasks: VolunteerTask[];
    readonly onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
    readonly onDeleteTask: (taskId: string) => void;
}

function KanbanColumn({ column, tasks, onMoveTask, onDeleteTask }: ReadonlyKanbanColumnProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);
    const { width } = useWindowDimensions();
    const columnWidth = useMemo(
        () => Math.min(MAX_COLUMN_WIDTH, width * COLUMN_WIDTH_RATIO),
        [width],
    );

    return (
        <View style={[styles.column, { width: columnWidth }]}>
            <View style={[styles.columnHeader, { borderLeftColor: column.color }]}>
                <View
                    style={[styles.columnIconContainer, { backgroundColor: column.color + '15' }]}
                >
                    <Ionicons
                        name={column.icon as keyof typeof Ionicons.glyphMap}
                        size={18}
                        color={column.color}
                    />
                </View>
                <Text style={[styles.columnTitle, { color: theme.colors.text }]}>
                    {column.title}
                </Text>
                <View style={[styles.columnCount, { backgroundColor: column.color + '20' }]}>
                    <Text style={[styles.columnCountText, { color: column.color }]}>
                        {tasks.length}
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.taskList}
                contentContainerStyle={styles.taskListContent}
                showsVerticalScrollIndicator={false}
            >
                {tasks.length === 0 ? (
                    <View style={styles.emptyColumn}>
                        <Ionicons
                            name="add-circle-outline"
                            size={32}
                            color={theme.colors.textSecondary}
                        />
                        <Text
                            style={[styles.emptyColumnText, { color: theme.colors.textSecondary }]}
                        >
                            No tasks
                        </Text>
                    </View>
                ) : (
                    tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onMoveTask={onMoveTask}
                            onDeleteTask={onDeleteTask}
                            columnColor={column.color}
                        />
                    ))
                )}
            </ScrollView>
        </View>
    );
}

interface ReadonlyAddTaskModalProps {
    readonly visible: boolean;
    readonly onClose: () => void;
    readonly onAdd: (title: string, description: string, priority: Priority) => void;
}

function AddTaskModal({ visible, onClose, onAdd }: ReadonlyAddTaskModalProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Priority>('medium');

    const handleAdd = () => {
        if (!title.trim()) {
            Alert.alert('Required', 'Please enter a task title.');
            return;
        }
        onAdd(title.trim(), description.trim(), priority);
        setTitle('');
        setDescription('');
        setPriority('medium');
        onClose();
    };

    if (!visible) return null;

    return (
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                        Add New Task
                    </Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: theme.colors.textSecondary }]}>
                        Title *
                    </Text>
                    <View
                        style={[
                            styles.inputContainer,
                            {
                                backgroundColor: theme.colors.background,
                                borderColor: theme.colors.border,
                            },
                        ]}
                    >
                        <Ionicons
                            name="text-outline"
                            size={18}
                            color={theme.colors.textSecondary}
                        />
                        <View style={styles.inputWrapper}>
                            <Text
                                style={[
                                    styles.inputText,
                                    {
                                        color: title
                                            ? theme.colors.text
                                            : theme.colors.textSecondary,
                                    },
                                ]}
                                onPress={() => {
                                    Alert.prompt?.(
                                        'Task Title',
                                        'Enter task title',
                                        (text: string) => setTitle(text),
                                    );
                                }}
                            >
                                {title || 'Enter task title'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: theme.colors.textSecondary }]}>
                        Description
                    </Text>
                    <View
                        style={[
                            styles.inputContainer,
                            styles.textArea,
                            {
                                backgroundColor: theme.colors.background,
                                borderColor: theme.colors.border,
                            },
                        ]}
                    >
                        <Ionicons
                            name="document-text-outline"
                            size={18}
                            color={theme.colors.textSecondary}
                        />
                        <View style={styles.inputWrapper}>
                            <Text
                                style={[
                                    styles.inputText,
                                    {
                                        color: description
                                            ? theme.colors.text
                                            : theme.colors.textSecondary,
                                    },
                                ]}
                                onPress={() => {
                                    Alert.prompt?.(
                                        'Description',
                                        'Enter task description',
                                        (text: string) => setDescription(text),
                                    );
                                }}
                            >
                                {description || 'Enter task description'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: theme.colors.textSecondary }]}>
                        Priority
                    </Text>
                    <View style={styles.priorityRow}>
                        {(['low', 'medium', 'high'] as const).map(p => {
                            const isSelected = priority === p;
                            return (
                                <TouchableOpacity
                                    key={p}
                                    style={[
                                        styles.priorityOption,
                                        {
                                            backgroundColor: isSelected
                                                ? PRIORITY_COLORS[p] + '20'
                                                : theme.colors.background,
                                            borderColor: isSelected
                                                ? PRIORITY_COLORS[p]
                                                : theme.colors.border,
                                        },
                                    ]}
                                    onPress={() => setPriority(p)}
                                >
                                    <Text
                                        style={[
                                            styles.priorityOptionText,
                                            {
                                                color: isSelected
                                                    ? PRIORITY_COLORS[p]
                                                    : theme.colors.textSecondary,
                                            },
                                        ]}
                                    >
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.modalActions}>
                    <TouchableOpacity
                        style={[styles.modalBtn, { backgroundColor: theme.colors.background }]}
                        onPress={onClose}
                    >
                        <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={handleAdd}
                    >
                        <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add Task</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

export default function VolunteerDashboard() {
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);
    const { width } = useWindowDimensions();
    const [tasks, setTasks] = useState<VolunteerTask[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, 'volunteerTasks'),
            snapshot => {
                const taskList: VolunteerTask[] = [];
                snapshot.forEach(docSnap => {
                    taskList.push({ id: docSnap.id, ...docSnap.data() } as VolunteerTask);
                });
                setTasks(taskList);
                setLoading(false);
            },
            () => {
                setLoading(false);
            },
        );

        return () => unsubscribe();
    }, []);

    const moveTask = useCallback(async (taskId: string, newStatus: TaskStatus) => {
        try {
            await updateDoc(doc(db, 'volunteerTasks', taskId), { status: newStatus });
        } catch {
            Alert.alert('Error', 'Failed to move task.');
        }
    }, []);

    const deleteTask = useCallback(async (taskId: string) => {
        Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'volunteerTasks', taskId));
                    } catch {
                        Alert.alert('Error', 'Failed to delete task.');
                    }
                },
            },
        ]);
    }, []);

    const addTask = useCallback(async (title: string, description: string, priority: Priority) => {
        try {
            const newTask = {
                title,
                description,
                status: 'todo' as TaskStatus,
                priority,
                createdAt: new Date().toISOString(),
            };
            await addDoc(collection(db, 'volunteerTasks'), newTask);
        } catch {
            Alert.alert('Error', 'Failed to add task.');
        }
    }, []);

    const tasksByStatus = useMemo(() => {
        const grouped: Record<TaskStatus, VolunteerTask[]> = {
            todo: [],
            in_progress: [],
            done: [],
        };
        tasks.forEach(task => {
            if (grouped[task.status]) {
                grouped[task.status].push(task);
            }
        });
        return grouped;
    }, [tasks]);

    return (
        <GestureHandlerRootView style={styles.gestureHandlerRoot}>
            <ScreenWrapper showLogo={false}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Volunteer Tasks</Text>
                        <Text style={styles.headerSubtitle}>
                            Drag tasks between columns to update status
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <Ionicons
                            name="hourglass-outline"
                            size={48}
                            color={theme.colors.textSecondary}
                        />
                        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                            Loading tasks...
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.boardContainer,
                            { paddingHorizontal: width >= TABLET_BREAKPOINT ? 20 : 8 },
                        ]}
                    >
                        {COLUMNS.map(column => (
                            <KanbanColumn
                                key={column.id}
                                column={column}
                                tasks={tasksByStatus[column.id]}
                                onMoveTask={moveTask}
                                onDeleteTask={deleteTask}
                            />
                        ))}
                    </ScrollView>
                )}

                <AddTaskModal
                    visible={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onAdd={addTask}
                />
            </ScreenWrapper>
        </GestureHandlerRootView>
    );
}
