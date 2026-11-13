/**
 * DSH Keeper — client half.
 *
 * Registers the sidebar panel launcher, the main management panel, a
 * Settings → Plugins page and a row in the panel list's More menu. The UI is
 * built from plain React elements and host theme tokens only: no harness
 * client packages are required.
 */
(function dshKeeperModule() {
const NS = 'dsh-keeper';
const PANEL_ID = 'dsh-keeper';
const API_BASE = '/dsh-keeper/api/';
const LEGACY_BUNDLE = 'dsh-sidebar-studio';
const STORAGE_PREFIX = 'dsh-keeper:';
const LEGACY_STORAGE_PREFIX = 'dsh-sidebar-studio:';

function migrateLegacyStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    for (const suffix of ['ui-prefs', 'notify-cursor', 'notify-epoch', 'panel-memory']) {
      const newKey = STORAGE_PREFIX + suffix;
      if (window.localStorage.getItem(newKey) !== null) continue;
      const oldValue = window.localStorage.getItem(LEGACY_STORAGE_PREFIX + suffix);
      if (oldValue !== null) window.localStorage.setItem(newKey, oldValue);
    }
  } catch {
    /* best effort: a blocked localStorage must not stop the plugin */
  }
}
/** Reserved ids the visibility page manages beyond live panellist entries. */
const MORE_PANEL_ID = 'more';
const MORE_ROW_BROWSE = 'more.browse';
const MORE_ROW_CREATE = 'more.create';
const MORE_ROW_MARKER = 'data-dsh-keeper-more-row';
/** The built-in [plugins] entry is hard-pinned by the host; we hide it via CSS. */
const PLUGINS_PANEL_ID = 'plugins';

/** Sort choices for the sessions toolbar, in display order (labels via t). */
const SORT_OPTIONS = [
  { id: 'updated', key: 'sortUpdated' },
  { id: 'size', key: 'sortSize' },
  { id: 'title', key: 'sortTitle' },
];

/** Assigned in the module factory; every component reads it from here. */
let React = null;

const DICT = {
  zh: {
    panelName: 'DSH 管家',
    moreOpen: 'DSH 管家',
    mainTitle: 'DSH 管家',
    mainSubtitle: '统一管理工作区会话、插件、侧栏入口与通知',
    tabSessions: '会话管理',
    tabTrash: '回收站',
    tabPanels: '插件管理',
    tabNotify: '通知管理',
    notifyTitle: '任务状态通知',
    notifySubtitle: '允许任务完成或失败时接收通知',
    notifyEnabled: '启用通知',
    notifyEnabledHint: '关闭后不再发送任何提醒。',
    notifyChannels: '提醒方式',
    notifyChannelsHint: '打开后允许在任务完成或失败时接收通知，请在 Windows 的系统设置 > 通知中开启通知，以便及时收到提醒。',
    notifyChannelBanner: '横幅',
    notifyChannelSound: '声音',
    notifySoundHint: '打开后，不论 DSH 在前台或后台，你都会收到声音提示。',
    notifyVolume: '音量设置',
    notifySounds: '提示音',
    notifySoundDefault: '默认',
    notifySoundPlay: '播放声音',
    notifySoundPick: '自定义声音（mp3 / wav / ogg）',
    notifySoundClear: '恢复默认声音',
    notifySoundSaved: '自定义提示音已保存。',
    notifySoundSaveFailed: '保存提示音失败',
    notifySoundResetDone: '已恢复默认提示音。',
    notifySoundTooLarge: '音频文件不能超过 2 MB。',
    notifyPermission: '系统通知权限',
    notifyPermissionDefault: '尚未授权',
    notifyPermissionGranted: '已授权',
    notifyPermissionDenied: '已被拒绝（可在系统设置中恢复）',
    notifyPermissionUnsupported: '当前环境不支持系统通知',
    notifyRequestPermission: '授权系统通知',
    notifyTest: '发送测试通知',
    notifyTestTitle: 'DSH 管家测试通知',
    notifyTestBody: '通知与声音工作正常。',
    notifyDone: '任务完成',
    notifyAsk: '等待操作',
    notifyInterrupt: '异常打断',
    notifySystem: '系统通知',
    notifySystemHint: '打开后，只有当 DSH 在后台或失焦时，你才会收到横幅提示。',
    notifyBehavior: '通知点击',
    notifyOpenOnClick: '打开对应会话',
    notifyOpenOnClickHint: '点击通知时切换到该会话。',
    notifyReset: '恢复默认设置',
    notifyResetDone: '通知设置已恢复默认',
    notifyUndone: '已撤销，通知设置恢复到重置前的状态。',
    notifySaveFailed: '保存通知设置失败',
    notifyHostStale: '通知服务未就绪：请完全退出并重启 DSH 桌面端后刷新。',
    notifyPermissionGrantedToast: '已获得系统通知权限。',
    notifyPermissionDeniedToast: '系统通知权限被拒绝，可在系统设置中开启。',
    notifyDoneTitle: '会话任务完成',
    notifyErrorTitle: '会话任务失败',
    notifyStoppedTitle: '会话任务已停止',
    notifyAskTitle: '需要你操作',
    notifyDoneSuffix: '任务完成',
    notifyErrorSuffix: '任务失败',
    notifyStoppedSuffix: '任务中断',
    notifyAskSuffix: '等待操作',
    notifyAskApproval: '需要授权',
    notifyAskQuestions: '有 {n} 个问题待回答',
    notifyAskGeneric: '需要你的操作',
    notifyDoneBody: '可返回 DSH 查看结果。',
    notifyStoppedBody: '任务已停止，可返回 DSH 查看详情。',
    notifyErrorBody: '任务失败：{detail}，可返回 DSH 查看详情。',
    notifyErrorBodyPlain: '任务失败，可返回 DSH 查看详情。',
    notifyAskApprovalBody: '需要你确认操作，请返回 DSH 继续。',
    notifyAskQuestionsBody: '有 {n} 个问题待回答，请返回 DSH 继续。',
    notifyAskGenericBody: '请返回 DSH 继续。',
    notifyUntitled: '未命名会话',
    notifyEmpty: '暂时没有新的提醒。',
    searchPlaceholder: '搜索会话标题、工作区…',
    sortUpdated: '按最近活动',
    sortSize: '按占用大小',
    sortTitle: '按标题',
    sortLabel: '排序方式',
    sessionFilterLabel: '按状态筛选',
    expandGroup: '展开分组',
    collapseGroup: '折叠分组',
    panelEntryHint: '控制该入口是否显示在侧栏（不影响插件是否启用）。',
    selectAll: '全选',
    clearAll: '取消全选',
    clearSelection: '取消选择',
    selectedN: '已选 {n} 项',
    archive: '归档',
    unarchive: '取消归档',
    moveToTrash: '移入回收站',
    restore: '恢复',
    purge: '彻底删除',
    open: '打开',
    exportAction: '导出',
    autoClean: '清理空会话',
    autoCleanEmpty: '没有可清理的空会话',
    cleanBlankConfirmTitle: '清理空会话',
    cleanBlankConfirmBody: '将把 {n} 个空会话移入回收站，之后可以恢复。',
    showPath: '显示路径',
    hidePath: '隐藏路径',
    openPath: '打开路径',
    openPathRestart: '打开路径失败：宿主模块还是旧版本，请完全退出并重启 DSH 后再试。',
    openSessionFailed: '无法打开该会话，请刷新后重试。',
    openSessionHint: '点击可在工作区中打开此会话',
    sessionTitleLabel: '标题：',
    sessionPathLabel: '路径：',
    sessionActionLabel: '操作：',
    archiveSessionHint: '归档后从列表隐藏，可在归档筛选里找回',
    unarchiveSessionHint: '取消归档，重新显示在会话列表',
    trashSessionHint: '先移入回收站，彻底删除前还可恢复',
    exportSessionHint: '选择格式后导出该会话',
    emptyTrash: '清空回收站',
    trashEmptied: '回收站已清空',
    refresh: '刷新',
    loading: '正在加载…',
    loadFailed: '加载失败：{msg}',
    retry: '重试',
    noSessions: '当前工作区还没有会话。',
    noVisibleSessions: '没有匹配的会话。',
    noTrash: '回收站是空的。',
    running: '运行中',
    archived: '已归档',
    blank: '空会话',
    messagesN: '{n} 条消息',
    workspaceGroup: '{n} 个会话',
    defaultWorkspace: '默认工作区',
    total: '共 {n} 个会话 · {size}',
    movedToTrash: '已移入回收站 {n} 项',
    archivedMsg: '已归档 {n} 项',
    restoredMsg: '已恢复 {n} 项',
    purgedMsg: '已彻底删除 {n} 项',
    cleanedMsg: '已清理 {n} 个空会话',
    undo: '撤销',
    confirmPurgeTitle: '彻底删除会话？',
    confirmPurgeBody: '将从磁盘删除 {n} 个会话（约 {size}）。此操作不可撤销，删除后重启也不会恢复。',
    confirmEmptyTitle: '清空回收站？',
    confirmEmptyBody: '将彻底删除回收站中全部 {n} 个会话（约 {size}），此操作不可撤销。',
    cancel: '取消',
    confirm: '确认删除',
    topSizes: '空间占用排行',
    topSizesHint: '按会话日志占用空间从大到小排列，共 {n} 个会话；点击标题或「选中」可加入批量操作。',
    selectHint: '点击选中此会话，加入批量操作。',
    selectTop: '选中',
    panelsTitle: '插件管理',
    panelsHint: '开关只控制侧栏入口的显示，不会停用插件本身。',
    moreMenu: '更多',
    moreMenuMeta: '侧栏面板列表底部的分组菜单',
    moreBrowse: '浏览更多插件',
    moreCreate: '创建你的插件',
    moreRowsHint: '「更多」隐藏后，这个快捷入口也会一起隐藏。',
    openPluginsPanel: '打开官方插件面板',
    fixedEntriesTitle: '内置固定入口',
    menuTag: '菜单',
    shortcutTag: '快捷',
    builtinTagHint: '由 DSH 内置提供，无法卸载（仍可从侧栏隐藏）。',
    menuTagHint: '侧栏底部的分组菜单。',
    shortcutTagHint: '该菜单内的快捷入口。',
    autoHiddenTag: '随子项隐藏',
    autoHiddenHint:
      '两个快捷入口都隐藏后，「更多」会自动隐藏；打开任一快捷入口即可恢复。',
    panelsSearchPlaceholder: '搜索插件名称、包名或入口 id…',
    panelsSearchEmpty: '没有匹配的插件。',
    backToTop: '回到顶部',
    pluginsAlways: '始终显示',
    panelExpand: '展开详情',
    panelCollapse: '折叠详情',
    expandAllDetails: '全部展开',
    collapseAllDetails: '全部折叠',
    panelPkgFull: '完整包名',
    panelEntryId: '入口 id',
    panelVersion: '版本',
    panelOrigin: '来源',
    panelSource: '安装方式',
    panelLoadState: '加载状态',
    panelReadOnly: '只读原因',
    panelRemovable: '是否可卸载',
    panelDescription: '描述',
    panelOpen: '打开面板',
    panelCopyId: '复制 id',
    panelCopied: '已复制 id',
    panelBuiltin: '内置',
    panelOfficial: '官方',
    panelThirdParty: '第三方',
    panelLocal: '本地插件',
    panelStateActive: '已启用',
    panelStateDisabled: '已禁用',
    panelStateFailed: '加载失败',
    panelStateReadOnly: '由管理端管理',
    panelStateUnaddressable: '不可寻址（由 DSH 内部管理）',
    panelPhasePending: '等待加载',
    panelPhaseLoading: '加载中',
    panelPhaseActive: '已激活',
    panelPhaseFailed: '加载失败',
    panelPhaseUnloading: '卸载中',
    panelPhaseNotLoaded: '未加载',
    panelPhaseBuiltin: '随应用加载',
    panelYes: '是',
    panelNo: '否',
    panelUnknown: '未知',
    panelNoDescription: '该插件没有提供描述。',
    panelDetailsFailed: '详情加载失败。',
    panelInventoryUnavailable: '无法读取插件清单，当前仅显示侧栏入口。',
    translateToZh: '译成中文',
    showOriginalDesc: '显示原文',
    showTranslatedDesc: '显示译文',
    translating: '翻译中…',
    retryTranslate: '重试翻译',
    translateFailed: '翻译失败，请稍后重试。',
    translateRestart: '翻译接口未加载：请完全退出并重启 DSH 桌面端后再试。',
  panelInventoryRestart: '插件清单接口未加载：请完全退出并重启 DSH 桌面端后刷新。',
  othersTitle: '其他已加载插件',
  othersEmpty: '其他已加载插件均已提供侧栏入口。',
  enabledPanelsTitle: '侧栏面板插件',
  uninstallLockedBuiltin: 'DSH 内置插件，随客户端提供，无法卸载。',
  uninstallLockedSelf: 'DSH 管家不能在自身界面卸载，可在插件管理器中操作。',
  uninstallLockedNoBundle: '该插件没有独立的插件包，无法卸载。',
  uninstallLockedManaged: '由 DSH 管理（只读或受保护），不能卸载。',
  uninstallLockedBuiltinShort: '内置插件',
  uninstallLockedSelfShort: '插件自身',
  uninstallLockedNoBundleShort: '无独立插件包',
  uninstallLockedManagedShort: '由 DSH 管理',
  tagEnabled: '已启用',
  tagLoading: '未加载',
  tagFailed: '加载失败',
  tagDisabled: '已禁用',
  tagBuiltin: '内置',
  scopeAll: '全部',
  scopeGlobal: '全局',
  scopeSession: '会话',
  scopeBoth: '全局·会话',
  scopeTitle: '作用域',
  scopeGlobalHint: '由 DSH 主程序加载，应用范围内常驻，不随会话预设变化。',
  scopeSessionHint: '由 Agent 预设加载，只在启用该预设的会话里生效。',
  scopeBothHint: '全局层与 Agent 预设里都包含这一项；列表里的启停只作用于全局层。',
  tagDisabledHint: '该插件已在 profile 中被禁用；启用后需要重启 DSH 才生效。',
  tagLoadingHint: '插件正在装载、等待装载或卸载，稍后刷新可看到最新状态。',
  tagFailedHint: '插件加载出错，展开详情查看原因，或重启 DSH 后重试。',
  scopePresetManagedHint: '该项属于 Agent 预设，不能在这里启停；请到「设置 → Agent 预设」调整。',
  scopePresets: '所属预设',
  scopePresetManaged: '由 Agent 预设管理',
  scopeConditional: '条件启用',
  scopeDefaultPreset: '默认',
  scopeFilterLabel: '按作用域筛选',
  statusEnabled: '已启用',
  statusDisabled: '已禁用',
  enablePlugin: '启用',
  disablePlugin: '禁用',
  uninstallPlugin: '卸载',
  cannotUninstall: '不可卸载',
  selfPlugin: 'DSH 管家自身受保护，不能在此禁用或卸载。',
  readonlyPlugin: '该插件只读，需在插件管理器中修改。',
  uninstallConfirmTitle: '卸载插件',
  uninstallConfirmBody: '将卸载 {name} 及其侧栏入口。此操作会修改 profile 并重新加载，可能需要重启 DSH。',
  uninstallConfirmAction: '确认卸载',
  uninstalledMsg: '已卸载 {name}',
  actionRestart: '操作已提交，请完全退出并重启 DSH 后生效。',
  actionFailed: '操作失败：{msg}',
    presetLean: '精简侧栏',
    presetAll: '全部显示',
    resetPanels: '恢复默认',
    conflictTitle: '入口名称冲突',
    conflictBody: '以下入口使用了相同名称，隐藏其中一个会同时隐藏同名的另一个：{names}',
    entryHidden: '「DSH 管家」入口当前已隐藏，你仍可从设置页恢复。',
    showEntry: '重新显示入口',
    trashHint: '删除的会话会先进入这里，可在彻底删除前恢复。',
    deletedAt: '删除于 {time}',
    sizeLabel: '占用 {size}',
    exportStart: '正在导出…',
    exportDone: '已导出会话日志',
    exportDialogTitle: '导出会话',
    exportDialogHint: '选择导出格式',
    exportFileNameLabel: '文件名',
    exportSetDefault: '设为默认',
    exportDefaultSaved: '已设为默认导出格式：{name}',
    exportUntitled: '会话',
    exportFormatMd: 'Markdown 文件',
    exportFormatMdHint: '标题、元信息与消息的易读转录',
    exportFormatTxt: '纯文本',
    exportFormatTxtHint: '不带格式的纯文本转录',
    exportFormatHtml: 'HTML 网页',
    exportFormatHtmlHint: '自包含网页，可直接用浏览器打开',
    exportFormatJsonl: 'JSONL 事件流',
    exportFormatJsonlHint: '逐行 JSON 原始事件，便于程序处理',
    exportFormatZstd: '原始压缩日志',
    exportFormatZstdHint: '原始 .jsonl.zstd，可直接放回会话目录',
    exportHostRestart: '导出接口还是旧版本：请完全退出并重启 DSH 桌面端后再试。',
    exportDefaultRestart: '默认导出格式未能保存：请完全退出并重启 DSH 桌面端后再试。',
    busy: '处理中…',
    settingsNav: 'DSH 管家',
    settingsHint: '设置页位于「设置 → DSH 管家」。',
    settingsTitle: 'DSH 管家设置',
    settingsSubtitle: '删除策略与侧栏入口的默认行为',
    defaultDeleteMode: '默认删除行为',
    modeTrash: '移入回收站',
    modeTrashHint: '推荐。会话先进入回收站，可恢复；彻底删除需要再次确认。',
    modeArchive: '仅归档',
    modeArchiveHint: '只从侧栏隐藏，不移动磁盘文件，可从会话列表取消归档。',
    confirmPurgeLabel: '彻底删除前二次确认',
    confirmPurgeHint: '关闭后彻底删除不再弹出确认框，请谨慎使用。',
    entryVisible: '显示侧栏入口',
    entryVisibleHint: '关闭后侧栏底部不再显示「DSH 管家」图标，设置页仍然可用。',
    resetSettings: '恢复默认设置',
    resetSettingsDone: '已恢复默认设置',
    about: '关于',
    version: '版本 {v}',
    dataDir: '数据目录',
    trashDir: '回收站目录',
    sessionsRoot: '会话日志目录',
    settingsSaved: '设置已保存',
    exportDefaultFormat: '默认导出格式',
    exportDefaultFormatHint: '导出菜单打开时会预先选中这个格式。',
    clearTranslationCache: '清除翻译缓存',
    clearTranslationCacheHint: '删除已缓存的插件描述中文翻译，下次翻译会重新请求模型。',
    translationCacheCleared: '翻译缓存已清除',
    openDataDir: '打开数据目录',
    openDataDirHint: '在系统中打开插件数据与回收站所在目录。',
    openDataDirFailed: '无法打开数据目录。',
    panelsSaved: '侧栏入口设置已保存',
    runningHint: '会话运行中，无法删除',
    emptyTrashDisabled: '回收站为空',
    unknownWorkspace: '未知工作区',
  },
  en: {
    panelName: 'DSH Keeper',
    moreOpen: 'DSH Keeper',
    mainTitle: 'DSH Keeper',
    mainSubtitle: 'Sessions, plugins, sidebar entries, and notifications — all in one place.',
    tabSessions: 'Sessions',
    tabTrash: 'Trash',
    tabPanels: 'Plugin manager',
    tabNotify: 'Notification manager',
    notifyTitle: 'Task status notifications',
    notifySubtitle: 'Allow notifications when a task finishes or fails',
    notifyEnabled: 'Enable notifications',
    notifyEnabledHint: 'Off stops all reminders.',
    notifyChannels: 'How to notify',
    notifyChannelsHint:
      'On lets you receive notifications when a task finishes or fails. Enable notifications in Windows Settings > Notifications so they arrive in time.',
    notifyChannelBanner: 'Banner',
    notifyChannelSound: 'Sound',
    notifySoundHint: 'When on, sound plays whether DSH is in the foreground or background.',
    notifyVolume: 'Volume',
    notifySounds: 'Tones',
    notifySoundDefault: 'Default',
    notifySoundPlay: 'Play sound',
    notifySoundPick: 'Custom sound (mp3 / wav / ogg)',
    notifySoundClear: 'Reset to default sound',
    notifySoundSaved: 'Custom sound saved.',
    notifySoundSaveFailed: 'Could not save the sound',
    notifySoundResetDone: 'Default sound restored.',
    notifySoundTooLarge: 'The audio file must be 2 MB or smaller.',
    notifyPermission: 'System notification permission',
    notifyPermissionDefault: 'Not granted yet',
    notifyPermissionGranted: 'Granted',
    notifyPermissionDenied: 'Denied (restore it in system settings)',
    notifyPermissionUnsupported: 'System notifications are not available here',
    notifyRequestPermission: 'Grant system notifications',
    notifyTest: 'Send test notification',
    notifyTestTitle: 'DSH Keeper test notification',
    notifyTestBody: 'Notifications and sound are working.',
    notifyDone: 'Task finished',
    notifyAsk: 'Waiting for input',
    notifyInterrupt: 'Interrupted',
    notifySystem: 'System notification',
    notifySystemHint: 'When on, banners appear only while DSH is in the background or unfocused.',
    notifyBehavior: 'Notification click',
    notifyOpenOnClick: 'Open the related session',
    notifyOpenOnClickHint: 'Switches to that session when the notification is clicked.',
    notifyReset: 'Restore defaults',
    notifyResetDone: 'Notification settings restored',
    notifyUndone: 'Undone — notification settings are back to their previous values.',
    notifySaveFailed: 'Could not save notification settings',
    notifyHostStale: 'Notification service is not ready: fully quit and restart the DSH desktop app, then refresh.',
    notifyPermissionGrantedToast: 'System notification permission granted.',
    notifyPermissionDeniedToast: 'System notification permission was denied. Enable it in system settings.',
    notifyDoneTitle: 'Session task finished',
    notifyErrorTitle: 'Session task failed',
    notifyStoppedTitle: 'Session task stopped',
    notifyAskTitle: 'Your input is needed',
    notifyDoneSuffix: 'Task finished',
    notifyErrorSuffix: 'Task failed',
    notifyStoppedSuffix: 'Task interrupted',
    notifyAskSuffix: 'Waiting for you',
    notifyAskApproval: 'Approval needed',
    notifyAskQuestions: '{n} questions waiting',
    notifyAskGeneric: 'Your input is needed',
    notifyDoneBody: 'Open DSH to view the result.',
    notifyStoppedBody: 'The task stopped. Open DSH for details.',
    notifyErrorBody: 'Task failed: {detail}. Open DSH for details.',
    notifyErrorBodyPlain: 'The task failed. Open DSH for details.',
    notifyAskApprovalBody: 'Your approval is needed. Return to DSH to continue.',
    notifyAskQuestionsBody: '{n} questions are waiting. Return to DSH to continue.',
    notifyAskGenericBody: 'Return to DSH to continue.',
    notifyUntitled: 'Untitled session',
    notifyEmpty: 'No new notifications yet.',
    searchPlaceholder: 'Search sessions or workspaces…',
    sortUpdated: 'Last activity',
    sortSize: 'Size',
    sortLabel: 'Sort by',
  sessionFilterLabel: 'Filter by status',
  expandGroup: 'Expand group',
  collapseGroup: 'Collapse group',
  panelEntryHint: 'Toggles whether this entry shows in the sidebar (plugin enablement is separate).',
    sortTitle: 'Title',
    selectAll: 'Select all',
    clearAll: 'Clear all',
    clearSelection: 'Clear',
    selectedN: '{n} selected',
    archive: 'Archive',
    unarchive: 'Unarchive',
    moveToTrash: 'Move to trash',
    restore: 'Restore',
    purge: 'Delete permanently',
    open: 'Open',
    exportAction: 'Export',
    autoClean: 'Clean blank sessions',
    autoCleanEmpty: 'No blank sessions to clean',
    cleanBlankConfirmTitle: 'Clean blank sessions',
    cleanBlankConfirmBody: 'Move {n} blank sessions to the trash? You can restore them later.',
    showPath: 'Show path',
    hidePath: 'Hide path',
    openPath: 'Open path',
    openPathRestart: 'Could not open the path: the host module is still an older version. Fully quit and restart DSH, then try again.',
    openSessionFailed: 'Could not open that session. Refresh and try again.',
    openSessionHint: 'Click to open this session in the workspace',
    sessionTitleLabel: 'Title: ',
    sessionPathLabel: 'Path: ',
    sessionActionLabel: 'Action: ',
    archiveSessionHint: 'Hide from the list; restore it from the archived filter',
    unarchiveSessionHint: 'Unarchive to show it in the session list again',
    trashSessionHint: 'Move to trash; still restorable before purging',
    exportSessionHint: 'Choose a format and export this session',
    emptyTrash: 'Empty trash',
    trashEmptied: 'Trash emptied',
    refresh: 'Refresh',
    loading: 'Loading…',
    loadFailed: 'Failed to load: {msg}',
    retry: 'Retry',
    noSessions: 'No sessions in this workspace yet.',
    noVisibleSessions: 'No sessions match your search.',
    noTrash: 'The trash is empty.',
    running: 'Running',
    archived: 'Archived',
    blank: 'Blank',
    messagesN: '{n} messages',
    workspaceGroup: '{n} sessions',
    defaultWorkspace: 'Default workspace',
    total: '{n} sessions · {size}',
    movedToTrash: 'Moved {n} to trash',
    archivedMsg: 'Archived {n}',
    restoredMsg: 'Restored {n}',
    purgedMsg: 'Permanently deleted {n}',
    cleanedMsg: 'Cleaned {n} blank sessions',
    undo: 'Undo',
    confirmPurgeTitle: 'Delete permanently?',
    confirmPurgeBody: 'This removes {n} sessions ({size}) from disk. It cannot be undone and will not come back after a restart.',
    confirmEmptyTitle: 'Empty the trash?',
    confirmEmptyBody: 'This permanently deletes all {n} sessions in the trash ({size}). It cannot be undone.',
    cancel: 'Cancel',
    confirm: 'Delete permanently',
    topSizes: 'Largest sessions',
    topSizesHint: 'Ranked by session log size, largest first — {n} sessions. Click a title or Select to add it to a batch.',
    selectHint: 'Click to select this session for batch actions.',
    selectTop: 'Select',
    panelsTitle: 'Plugin manager',
    panelsHint: 'Switches only hide the sidebar entry; the plugin keeps running.',
    moreMenu: 'More',
    moreMenuMeta: 'Grouped menu at the end of the panel list',
    moreBrowse: 'Browse other plugins',
    moreCreate: 'Create your plugin',
    moreRowsHint: 'Hiding “More” also hides this shortcut.',
    openPluginsPanel: 'Open the official plugins panel',
    fixedEntriesTitle: 'Built-in fixed entries',
    menuTag: 'Menu',
    shortcutTag: 'Shortcut',
    builtinTagHint: 'Provided by DSH itself and cannot be uninstalled (you can still hide it from the sidebar).',
    menuTagHint: 'The grouped menu at the bottom of the sidebar.',
    shortcutTagHint: 'A shortcut inside that menu.',
    autoHiddenTag: 'Auto-hidden',
    autoHiddenHint:
      '“More” hides automatically once both shortcuts are hidden. Re-enable either shortcut to bring it back.',
    panelsSearchPlaceholder: 'Search plugin name, package or entry id…',
    panelsSearchEmpty: 'No matching plugins.',
    backToTop: 'Back to top',
    pluginsAlways: 'Always shown',
    panelExpand: 'Show details',
    panelCollapse: 'Hide details',
    expandAllDetails: 'Expand all',
    collapseAllDetails: 'Collapse all',
    panelPkgFull: 'Full package name',
    panelEntryId: 'Panel id',
    panelVersion: 'Version',
    panelOrigin: 'Origin',
    panelSource: 'Install source',
    panelLoadState: 'Load state',
    panelReadOnly: 'Read-only reason',
    panelRemovable: 'Can uninstall',
    panelDescription: 'Description',
    panelOpen: 'Open panel',
    panelCopyId: 'Copy id',
    panelCopied: 'Panel id copied',
    panelBuiltin: 'Built-in',
    panelOfficial: 'Official',
    panelThirdParty: 'Third-party',
    panelLocal: 'Local plugin',
    panelStateActive: 'Enabled',
    panelStateDisabled: 'Disabled',
    panelStateFailed: 'Failed to load',
    panelStateReadOnly: 'Managed by profile',
    panelStateUnaddressable: 'Unaddressable (managed by DSH internals)',
    panelPhasePending: 'Pending',
    panelPhaseLoading: 'Loading',
    panelPhaseActive: 'Active',
    panelPhaseFailed: 'Failed',
    panelPhaseUnloading: 'Unloading',
    panelPhaseNotLoaded: 'Not loaded',
    panelPhaseBuiltin: 'Loaded with the app',
    panelYes: 'Yes',
    panelNo: 'No',
    panelUnknown: 'Unknown',
    panelNoDescription: 'This plugin provides no description.',
    panelDetailsFailed: 'Could not load details.',
    panelInventoryUnavailable: 'Plugin inventory is unavailable; showing sidebar entries only.',
    translateToZh: 'Translate to Chinese',
    showOriginalDesc: 'Show original',
    showTranslatedDesc: 'Show translation',
    translating: 'Translating…',
    retryTranslate: 'Retry translation',
    translateFailed: 'Translation failed. Try again later.',
    translateRestart: 'The translation endpoint is not loaded yet. Fully quit and restart DSH, then try again.',
  panelInventoryRestart: 'The plugin inventory endpoint is not loaded yet. Fully quit and restart DSH, then refresh.',
  othersTitle: 'Other loaded plugins',
  othersEmpty: 'Every loaded plugin already has a sidebar entry.',
  enabledPanelsTitle: 'Sidebar panel plugins',
  uninstallLockedBuiltin: 'Built into DSH and shipped with the app, so it cannot be uninstalled.',
  uninstallLockedSelf: 'DSH Keeper cannot uninstall itself here; use the plugin manager instead.',
  uninstallLockedNoBundle: 'This plugin ships without a removable bundle.',
  uninstallLockedManaged: 'Managed by DSH (read-only or protected), so it cannot be uninstalled.',
  uninstallLockedBuiltinShort: 'Built-in',
  uninstallLockedSelfShort: 'this plugin',
  uninstallLockedNoBundleShort: 'no removable bundle',
  uninstallLockedManagedShort: 'managed by DSH',
  tagEnabled: 'Enabled',
  tagLoading: 'Not loaded',
  tagFailed: 'Failed',
  tagDisabled: 'Disabled',
  tagBuiltin: 'Built-in',
  scopeAll: 'All',
  scopeGlobal: 'Global',
  scopeSession: 'Session',
  scopeBoth: 'Global · Session',
  scopeTitle: 'Scope',
  scopeGlobalHint: 'Loaded by the DSH app itself; always available and independent of Agent presets.',
  scopeSessionHint: 'Loaded by an Agent preset; only active in sessions that use that preset.',
  scopeBothHint: 'Present in both the global layer and an Agent preset; toggling here only affects the global layer.',
  tagDisabledHint: 'This plugin is disabled in the profile; restart DSH after enabling it.',
  tagLoadingHint: 'The plugin is loading or unloading; refresh shortly to see its latest state.',
  tagFailedHint: 'The plugin failed to load; expand its details or restart DSH and try again.',
  scopePresetManagedHint: 'This entry belongs to an Agent preset and cannot be toggled here; adjust it under Settings → Agent presets.',
  scopePresets: 'Presets',
  scopePresetManaged: 'Managed by the Agent preset',
  scopeConditional: 'Conditional',
  scopeDefaultPreset: 'default',
  scopeFilterLabel: 'Filter by scope',
  statusEnabled: 'Enabled',
  statusDisabled: 'Disabled',
  enablePlugin: 'Enable',
  disablePlugin: 'Disable',
  uninstallPlugin: 'Uninstall',
  cannotUninstall: 'Not removable',
  selfPlugin: 'DSH Keeper protects itself and cannot be disabled or removed here.',
  readonlyPlugin: 'This plugin is read-only; change it in the plugin manager.',
  uninstallConfirmTitle: 'Uninstall plugin',
  uninstallConfirmBody: 'This removes {name} and its sidebar entry. The profile will be rewritten and reloaded; a full restart may be required.',
  uninstallConfirmAction: 'Confirm uninstall',
  uninstalledMsg: 'Removed {name}',
  actionRestart: 'The change was submitted. Fully quit and restart DSH to apply it.',
  actionFailed: 'Action failed: {msg}',
    presetLean: 'Minimal sidebar',
    presetAll: 'Show all',
    resetPanels: 'Reset',
    conflictTitle: 'Duplicate entry names',
    conflictBody: 'These entries share a name, so hiding one also hides the other: {names}',
    entryHidden: 'The DSH Keeper entry is hidden. You can restore it from Settings.',
    showEntry: 'Show entry again',
    trashHint: 'Deleted sessions wait here before they are purged.',
    deletedAt: 'Deleted {time}',
    sizeLabel: '{size}',
    exportStart: 'Exporting…',
    exportDone: 'Session log exported',
    exportDialogTitle: 'Export session',
    exportDialogHint: 'Choose an export format.',
    exportFileNameLabel: 'File name',
    exportSetDefault: 'Set as default',
    exportDefaultSaved: 'Default export format: {name}',
    exportUntitled: 'session',
    exportFormatMd: 'Markdown',
    exportFormatMdHint: 'Readable transcript with title, metadata, and messages',
    exportFormatTxt: 'Plain text',
    exportFormatTxtHint: 'Unformatted transcript',
    exportFormatHtml: 'HTML page',
    exportFormatHtmlHint: 'Self-contained page you can open in a browser',
    exportFormatJsonl: 'JSONL events',
    exportFormatJsonlHint: 'Raw JSON events, one per line',
    exportFormatZstd: 'Raw compressed log',
    exportFormatZstdHint: 'Original .jsonl.zstd, ready to drop back into the sessions folder',
    exportHostRestart: 'The export API is still an older version. Fully quit and restart DSH, then try again.',
    exportDefaultRestart: 'The default export format was not saved. Fully quit and restart DSH, then try again.',
    busy: 'Working…',
    settingsNav: 'DSH Keeper',
    settingsHint: 'Find this page under Settings → DSH Keeper.',
    settingsTitle: 'DSH Keeper settings',
    settingsSubtitle: 'Delete policy and sidebar entry defaults',
    defaultDeleteMode: 'Default delete action',
    modeTrash: 'Move to trash',
    modeTrashHint: 'Recommended. Sessions go to the trash first and can be restored; purging asks again.',
    modeArchive: 'Archive only',
    modeArchiveHint: 'Hides the session from the sidebar without touching the log; unarchive from the session list.',
    confirmPurgeLabel: 'Confirm before permanent delete',
    confirmPurgeHint: 'When off, permanent deletion happens without a dialog. Use with care.',
    entryVisible: 'Show sidebar entry',
    entryVisibleHint: 'Hide the DSH Keeper icon at the sidebar foot; the settings page stays available.',
    resetSettings: 'Reset to defaults',
    resetSettingsDone: 'Defaults restored',
    about: 'About',
    version: 'Version {v}',
    dataDir: 'Data directory',
    trashDir: 'Trash directory',
    sessionsRoot: 'Session log directory',
    settingsSaved: 'Settings saved',
  exportDefaultFormat: 'Default export format',
  exportDefaultFormatHint: 'The export dialog preselects this format.',
  clearTranslationCache: 'Clear translation cache',
  clearTranslationCacheHint:
    'Removes cached Chinese translations of plugin descriptions; the next translation asks the model again.',
  translationCacheCleared: 'Translation cache cleared',
  openDataDir: 'Open data directory',
  openDataDirHint: 'Open the folder that stores plugin data and the trash.',
  openDataDirFailed: 'Could not open the data directory.',
    panelsSaved: 'Sidebar entry settings saved',
    runningHint: 'The session is running; it cannot be deleted',
    emptyTrashDisabled: 'Trash is empty',
    unknownWorkspace: 'Unknown workspace',
  },
};

const CSS = `
.ss-root{height:100%;overflow:auto;scrollbar-gutter:stable;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5;--ss-surface:color-mix(in srgb, var(--dsw-alias-label-primary) 6%, var(--dsw-alias-bg-base));--ss-surface-hover:color-mix(in srgb, var(--dsw-alias-label-primary) 11%, var(--dsw-alias-bg-base))}
.ss-page{max-width:1040px;margin:0 auto;padding:26px 32px 72px}
.ss-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
.ss-headmain{display:flex;gap:12px;align-items:center;min-width:0}
.ss-title{font-size:20px;font-weight:600;letter-spacing:.2px;margin:0}
.ss-sub{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:3px}
.ss-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ss-headside{display:flex;align-items:center;gap:8px;flex:none}
.ss-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-family:inherit;transition:background .15s ease,color .15s ease}
.ss-iconbtn:hover{background:var(--ss-surface-hover);color:var(--dsw-alias-label-primary)}
.ss-iconbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ss-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font-size:12px;font-family:inherit;cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease,transform .1s ease;white-space:nowrap}
.ss-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.ss-btn:active:not(:disabled){transform:translateY(1px)}
.ss-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ss-btn:disabled{opacity:.5;cursor:not-allowed}
.ss-btn.primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-bg-base))}
.ss-btn.primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 88%,var(--dsw-alias-bg-base));border-color:var(--dsw-alias-brand-primary);filter:brightness(1.06)}
.ss-btn.danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent)}
.ss-btn.danger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 22%,transparent)}
.ss-btn.ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}
.ss-btn.ghost:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.ss-btn.quiet{background:var(--ss-surface);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
.ss-btn.quiet:hover:not(:disabled){background:var(--ss-surface-hover);border-color:var(--dsw-alias-border-l2)}
.ss-btn.tiny{height:24px;padding:0 9px;font-size:11px;border-radius:6px}
.ss-tag{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;font-size:10.5px;line-height:16px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.ss-tag.on{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 32%,transparent)}
.ss-tag.loading{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 14%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 34%,transparent)}
.ss-tag.failed{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 13%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,transparent)}
.ss-tag.off{color:var(--dsw-alias-label-secondary);opacity:.72}
.ss-tag.disabled{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 32%,transparent)}
.ss-tag.scope-global,.ss-tag.scope-session,.ss-tag.scope-both{color:var(--dsw-alias-label-secondary);background:var(--ss-surface);border-color:var(--dsw-alias-border-l2)}
.ss-scopefilter{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
.ss-filterbar{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding-right:8px}
.ss-filterbar .ss-scopefilter{margin:0;flex:1;min-width:0}
.ss-expandall{flex:none}
.ss-filterdivider{flex:none;width:1px;height:18px;margin:0 2px;background:var(--dsw-alias-border-l2)}
.ss-chip.active{background:var(--ss-surface-hover);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-weight:600}
.ss-card.ss-plugincard{padding:0 14px;border:0}
.ss-card.ss-plugincard.ss-plugincard-collapsed{padding-bottom:16px}
.ss-card.ss-plugincard>.ss-sectiontitle:first-child{margin-top:10px}
.ss-band{height:8px;margin:12px -14px 10px;background:var(--ss-surface);border-radius:6px}
.ss-card.ss-plugincard>.ss-band:first-child{border-radius:10px 10px 6px 6px}
.ss-sectiontitle{font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary);margin:2px 0 6px}
.ss-sectiontoggle{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:2px 0;background:transparent;border:none;cursor:pointer;font-family:inherit;text-align:left}
.ss-sectiontoggle:hover{color:var(--dsw-alias-brand-primary)}
.ss-sectiontoggle .ss-expand-icon{margin-left:auto}
.ss-root.ss-main{overflow:hidden}
.ss-page.ss-page-main{box-sizing:border-box;height:100%;display:flex;flex-direction:column;max-width:none;margin:0;padding:0}
.ss-pane-main{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.ss-tabscroll{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable}
.ss-tabscroll::-webkit-scrollbar{width:5px}
.ss-tabscroll::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:8px}
.ss-tabscroll::-webkit-scrollbar-track{background:transparent}
.ss-root::-webkit-scrollbar{width:5px}
.ss-root::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:8px}
.ss-root::-webkit-scrollbar-track{background:transparent}
.ss-root::-webkit-scrollbar-button,
.ss-tabscroll::-webkit-scrollbar-button,
.ss-panelslist::-webkit-scrollbar-button,
.ss-rankscroll::-webkit-scrollbar-button,
.ss-root::-webkit-scrollbar-button:single-button,
.ss-tabscroll::-webkit-scrollbar-button:single-button,
.ss-panelslist::-webkit-scrollbar-button:single-button,
.ss-rankscroll::-webkit-scrollbar-button:single-button{display:none;width:0;height:0;background:transparent}
/* The scroll surface spans the whole panel so its scrollbar sits on the outer
   edge; the header and the tab content keep the centered 1040px reading column. */
.ss-main .ss-page-main>.ss-head,
.ss-main .ss-page-main>.ss-tabs,
.ss-main .ss-page-main>.ss-banner{box-sizing:border-box;width:100%;max-width:1040px;margin-left:auto;margin-right:auto;padding-left:32px;padding-right:32px}
.ss-main .ss-page-main>.ss-head{padding-top:26px}
.ss-tabinner{box-sizing:border-box;width:100%;max-width:1040px;margin:0 auto;padding:0 32px 32px}
.ss-panelswrap{box-sizing:border-box;width:100%;flex:1;min-height:0;display:flex;flex-direction:column}
.ss-panels{display:flex;flex-direction:column;flex:1;min-height:0}
.ss-panelshead{flex:none;box-sizing:border-box;width:100%;max-width:1040px;margin:0 auto;padding:0 32px}
.ss-panelslist{flex:1;min-height:0;overflow-y:auto;overflow-anchor:none;scrollbar-gutter:stable;margin:0;padding:0 35px 32px 32px}
.ss-panelslist>.ss-plugincard{box-sizing:border-box;width:100%;max-width:968px;margin-left:auto;margin-right:auto}
.ss-panelslist::-webkit-scrollbar{width:5px}
.ss-panelslist::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:8px}
.ss-panelslist::-webkit-scrollbar-track{background:transparent}
.ss-chip{appearance:none;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1);background:var(--ss-surface);color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease}
.ss-chip:hover:not(:disabled){background:var(--ss-surface-hover);border-color:var(--dsw-alias-border-l2)}
.ss-chip:disabled{opacity:.5;cursor:not-allowed}
.ss-tabs{display:flex;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:16px}
.ss-tab{appearance:none;background:none;border:none;border-bottom:2px solid transparent;color:var(--dsw-alias-label-secondary);padding:8px 12px;font-size:13px;font-family:inherit;cursor:pointer;transition:color .18s ease,border-color .18s ease}
.ss-tab:hover{color:var(--dsw-alias-label-primary)}
.ss-tab.active{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
.ss-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.ss-input{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 10px;color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit;min-width:220px;outline:none}
.ss-input:focus,.ss-input:focus-visible{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--dsw-alias-border-l2));background-color:var(--dsw-alias-bg-layer-1);box-shadow:none;outline:none}
.ss-searchrow{display:flex;align-items:center;gap:8px;margin:12px 0 10px;padding-right:8px}
.ss-searchrow .ss-input{flex:1;min-width:0}
.ss-backtop{position:fixed;right:28px;bottom:28px;z-index:6;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-prominent,0 6px 18px rgba(0,0,0,.28));cursor:pointer;transition:background .15s ease,transform .1s ease}
.ss-backtop:hover{background:var(--ss-surface-hover)}
.ss-backtop:active{transform:translateY(1px)}
.ss-backtop:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
/* sort control: same pill + popover menu shape as the host's language row
   (Settings -> General), rebuilt locally since plugin UI may not import the
   host's primitives */
.ss-menuwrap{position:relative;display:inline-flex}
.ss-menu-btn{appearance:none;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 9px 0 12px;border:none;border-radius:var(--dsw-radius-md,8px);background:var(--ss-surface);color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit;line-height:20px;cursor:pointer;transition:background .15s ease}
.ss-menu-btn:hover{background:var(--ss-surface-hover)}
.ss-menu-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ss-menu-btn[aria-expanded="true"]{background:var(--ss-surface-hover)}
.ss-menu-chevron{flex:none;opacity:.7;margin-left:2px}
.ss-menu-backdrop{position:fixed;inset:0;z-index:60}
.ss-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:61;display:flex;flex-direction:column;min-width:156px;padding:4px;background:var(--ss-surface-hover);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,10px);box-shadow:var(--dsw-elevation-prominent,0 10px 30px rgba(0,0,0,.35))}
.ss-menu-item{appearance:none;display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:6px 9px;border:none;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit;text-align:left;cursor:pointer;white-space:nowrap;transition:background .12s ease}
.ss-menu-item:hover{background:var(--ss-surface)}
.ss-menu-item[aria-checked="true"]{font-weight:600}
.ss-menu-check{flex:none;color:var(--dsw-alias-brand-primary)}
.ss-badge{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;font-size:11px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);white-space:nowrap}
.ss-badge.running{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.ss-badge.archived{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.ss-badge.blank{color:var(--dsw-alias-state-idle-primary)}
.ss-badge.hidden{color:var(--dsw-alias-state-warn-primary)}
.ss-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;margin-bottom:14px}
.ss-card h4{margin:0 0 10px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.3px;text-transform:uppercase}
.ss-cardhint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-secondary);margin:-4px 0 10px}
.ss-kpis{display:flex;gap:18px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:12px}
.ss-kpis b{color:var(--dsw-alias-label-primary);font-weight:600}
.ss-permission{font-weight:400}
.ss-permission.granted{color:var(--dsw-alias-state-success-primary)}
.ss-permission.denied{color:var(--dsw-alias-state-error-primary)}
.ss-permission.unsupported{color:var(--dsw-alias-label-tertiary)}
.ss-group{margin-bottom:18px}
.ss-grouphead{display:flex;align-items:center;gap:8px;padding:6px 2px;color:var(--dsw-alias-label-secondary);font-size:12px}
.ss-groupcollapse{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-family:inherit;transition:background .15s ease,color .15s ease}
.ss-groupcollapse:hover{background:var(--ss-surface-hover);color:var(--dsw-alias-label-primary)}
.ss-groupcollapse:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ss-groupcollapse-icon{transition:transform .15s ease}
.ss-groupcollapse-icon.collapsed{transform:rotate(-90deg)}
.ss-groupanim{overflow:hidden;transition:height .26s cubic-bezier(.2,0,0,1)}
.ss-grouphead b{color:var(--dsw-alias-label-primary);font-weight:600}
.ss-grouphead .ss-wspath{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px;opacity:.75;direction:rtl;text-align:left}
.ss-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;border:1px solid transparent;transition:background-color .18s ease,border-color .18s ease}
.ss-row:hover{background:var(--dsw-alias-bg-layer-1)}
.ss-row.selected{background:var(--dsw-alias-bg-layer-2)}
.ss-check{width:14px;height:14px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;flex:none;margin:0}
.ss-rowmain{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.ss-rowtitle{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);background:none;border:none;padding:0;text-align:left;font-family:inherit;cursor:pointer}
.ss-rowtitle:hover{text-decoration:underline;text-underline-offset:2px}
.ss-rowmain .ss-rowtitle{align-self:flex-start;max-width:100%}
/* usage ranking: position numbers; the top three tint red / orange / yellow */
.ss-rank{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 5px;border-radius:7px;border:1px solid transparent;font-size:12px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.ss-rank-1,.ss-rank-2,.ss-rank-3{background:color-mix(in srgb,currentColor 12%,transparent);border-color:color-mix(in srgb,currentColor 40%,transparent)}
.ss-rank-1{color:var(--dsw-alias-state-error-primary)}
.ss-rank-2{color:var(--dsw-alias-state-warn-primary)}
.ss-rank-3{color:#a97700}
body[data-ds-dark-theme] .ss-rank-3{color:#ecc94b}
/* the ranking holds every session; past ~5 rows it scrolls inside the card */
.ss-rankscroll{max-height:272px;overflow-y:auto;overflow-x:hidden;margin:0 -8px;padding:0 8px}
.ss-rankscroll::-webkit-scrollbar{width:5px}
.ss-rankscroll::-webkit-scrollbar-track{background:transparent}
.ss-rankscroll::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:999px}
.ss-rankscroll::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-border-l3)}
.ss-rowmeta{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ss-rowactions{display:flex;align-items:center;gap:10px;flex:none;margin-left:6px}
.ss-rowactions .ss-iconbtn{width:auto;height:auto;padding:4px 8px}
.ss-iconbtn{appearance:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:4px 7px;font-size:11px;font-family:inherit;cursor:pointer;white-space:nowrap}
.ss-iconbtn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ss-iconbtn:disabled{opacity:.4;cursor:not-allowed}
.ss-iconbtn.danger:hover:not(:disabled){color:var(--dsw-alias-state-error-primary)}
.ss-empty{color:var(--dsw-alias-label-secondary);padding:36px 8px;text-align:center;font-size:12px}
.ss-empty-illustrated{display:flex;flex-direction:column;align-items:center;padding:44px 8px 40px}
.ss-empty-illustrated svg{opacity:.5;margin-bottom:10px;flex:none}
/* skeleton: keeps the sessions layout on screen during a cold bootstrap so the
   page never flashes empty before the first snapshot arrives */
.ss-skeleton{padding:2px 0 8px}
.ss-skel{position:relative;overflow:hidden;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent)}
.ss-skel::after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent),transparent);animation:ss-skel-shimmer 1.25s ease-in-out infinite}
@keyframes ss-skel-shimmer{to{transform:translateX(100%)}}
.ss-skelmeta{display:flex;gap:10px;align-items:center;padding:4px 2px 14px}
.ss-skel-line{display:inline-block;height:10px;border-radius:4px}
.ss-skel-line.small{height:9px}
.ss-skel-group{height:12px;width:180px;margin:6px 2px 18px}
.ss-skelrow{display:flex;gap:12px;align-items:flex-start;padding:10px 2px}
.ss-skel-circle{width:18px;height:18px;border-radius:5px;flex:none;margin-top:2px}
.ss-skellines{display:flex;flex-direction:column;gap:8px;flex:1;min-width:0}
@media (prefers-reduced-motion: reduce){.ss-skel::after{animation:none}}
.ss-error{color:var(--dsw-alias-state-error-primary);font-size:12px;padding:12px 0}
.ss-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
/* switch: mirror the host primitive's own colors (border-l3 track, brand track
   when on, label-primary-foreground thumb) so the on/off states stay legible in
   both themes, with a slightly longer, eased slide than the host default */
.ss-switch{position:relative;box-sizing:border-box;width:36px;height:20px;padding:2px;border:0;border-radius:999px;background:var(--dsw-alias-border-l3);cursor:pointer;flex:none;transition:background-color .26s ease}
.ss-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
.ss-switch:disabled{opacity:.5;cursor:not-allowed}
.ss-switch:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.ss-switch span{position:absolute;top:2px;left:2px;display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-switch-thumb,var(--dsw-alias-label-secondary));transition:transform .26s cubic-bezier(.3,0,.2,1),background-color .26s ease}
.ss-switch[aria-checked="true"] span{transform:translateX(16px);background:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-bg-base))}
.ss-overlay{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px}
.ss-modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;max-width:480px;width:100%;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.ss-modal h3{margin:0 0 8px;font-size:15px;color:var(--dsw-alias-label-primary)}
.ss-modal p{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.65;margin:0 0 18px}
.ss-modalfoot{display:flex;justify-content:flex-end;gap:8px}
.ss-modal.ss-exportmodal{width:min(520px,calc(100vw - 48px))}
.ss-dialoghint{margin:-6px 0 14px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.55}
.ss-formatlist{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.ss-formatrow{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--ss-surface);color:var(--dsw-alias-label-primary);font-family:inherit;text-align:left;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.ss-formatrow:hover{background:var(--ss-surface-hover)}
.ss-formatrow.active{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 38%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,var(--ss-surface));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.ss-formatbody{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.ss-formatlabel{font-size:13px;font-weight:500;line-height:20px}
.ss-formatext{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.ss-formatcheck{flex:none;color:color-mix(in srgb,var(--dsw-alias-brand-primary) 62%,var(--dsw-alias-label-secondary))}
.ss-filename{display:flex;align-items:center;gap:10px;min-width:0;padding:10px 12px;margin-bottom:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base)}
.ss-filenamekey{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}
.ss-filenameval{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-primary)}
.ss-modalfoot .ss-modalfootstart{margin-right:auto}
.ss-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:1300;display:flex;align-items:center;gap:14px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 14px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.3);color:var(--dsw-alias-label-primary);max-width:min(560px,90vw)}
.ss-undoaction{display:inline-flex;align-items:center;gap:8px;flex:none;padding-left:10px;border-left:1px solid var(--dsw-alias-border-l2)}
.ss-undobtn{appearance:none;border:0;background:transparent;color:#007AFF;font-family:inherit;font-size:12px;font-weight:400;line-height:20px;padding:2px 4px;border-radius:6px;cursor:pointer}
.ss-undobtn:hover{background:transparent;color:#007AFF}
.ss-undobtn:focus-visible{outline:2px solid #007AFF;outline-offset:1px}
.ss-global-toast{position:fixed;right:20px;bottom:22px;z-index:1400;max-width:320px;padding:10px 14px;border-radius:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 8px 24px rgba(0,0,0,.3);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.5;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}
.ss-global-toast-open{opacity:1;transform:translateY(0)}
.ss-link{background:none;border:none;color:var(--dsw-alias-brand-primary);cursor:pointer;font-size:12px;padding:0;font-family:inherit}
.ss-link:hover{text-decoration:underline}
.ss-field{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.ss-field:last-child{border-bottom:none}
.ss-field:first-of-type{padding-top:2px}
.ss-fieldlabel{font-size:12px;color:var(--dsw-alias-label-primary)}
.ss-fieldlabel small{display:block;color:var(--dsw-alias-label-secondary);font-size:11px;margin-top:3px;max-width:520px;line-height:1.55}
.ss-radios{display:flex;flex-direction:column;gap:6px}
.ss-radio{display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-primary)}
.ss-radio input{accent-color:var(--dsw-alias-brand-primary);width:14px;height:14px;margin:0}
.ss-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.ss-settingshead{margin-bottom:16px}
.ss-chiprow{display:flex;gap:6px;flex-wrap:wrap}
.ss-panelitem{border-bottom:1px solid var(--dsw-alias-border-l1)}
.ss-panelitem:last-child{border-bottom:none}
.ss-panelrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;row-gap:6px;padding:9px 4px}
.ss-panelglyph{width:24px;height:24px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);font-size:11px;flex:none}
.ss-panelmain{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;cursor:pointer}
.ss-panellabel{font-size:12px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-panelid{font-size:10px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.ss-meta{font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-badge.ok{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,transparent)}
.ss-badge.error{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent)}
.ss-badge.muted{color:var(--dsw-alias-label-secondary);opacity:.85}
.ss-badge.info{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,transparent)}
.ss-expand{flex:none;width:22px;height:22px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.ss-expand:hover{background:var(--ss-surface-hover,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-label-primary)}
.ss-expand:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ss-expand-icon{transition:transform .16s ease}
.ss-expand-icon.open{transform:rotate(180deg)}
.ss-expand-spacer{flex:none;width:22px;height:22px}
.ss-subtree{margin-left:14px;border-left:1px solid var(--dsw-alias-border-l2)}
.ss-subtree .ss-panelitem:last-child{border-bottom:none}
.ss-subrow{position:relative;padding-left:10px}
.ss-subrow::before{content:'';position:absolute;left:0;top:50%;width:10px;height:1px;background:var(--dsw-alias-border-l2)}
.ss-detail{border-top:1px solid var(--dsw-alias-border-l1);padding:10px 12px 12px 34px;background:color-mix(in srgb,var(--ss-surface) 90%,#000 10%);border-radius:10px;margin:2px 0 8px}
.ss-detail-anim{display:grid;grid-template-rows:1fr;min-height:0;overflow:hidden;transition:height .26s cubic-bezier(.2,0,0,1)}
.ss-detail-anim.open{animation:ss-detail-in .26s cubic-bezier(.2,0,0,1) both}
.ss-detail-anim.closing{pointer-events:none}
.ss-detail-anim > *{min-width:0;min-height:0}
@keyframes ss-detail-in{from{grid-template-rows:0fr}to{grid-template-rows:1fr}}
.ss-detailgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px}
.ss-detailrow{display:flex;gap:8px;font-size:11px;line-height:18px;min-width:0;align-items:center;min-height:18px}
.ss-detailkey{flex:none;min-width:64px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.ss-detailval{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}
.ss-phase-pending{color:var(--dsw-alias-label-secondary)}
.ss-phase-loading{color:var(--dsw-alias-state-warn-primary)}
.ss-phase-active{color:var(--dsw-alias-state-success-primary)}
.ss-phase-failed{color:var(--dsw-alias-state-error-primary)}
.ss-phase-unloading{color:var(--dsw-alias-state-warn-primary)}
.ss-phase-notloaded{color:var(--dsw-alias-label-secondary)}
.ss-phase-builtin{color:var(--dsw-alias-label-secondary)}
.ss-phase-unknown{color:var(--dsw-alias-label-secondary)}
.ss-detaildesc{margin-top:8px;font-size:11.5px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.ss-detaildescrow{display:flex;align-items:flex-start;gap:8px;margin-top:8px}
.ss-detaildescrow .ss-detaildesc{margin-top:0;flex:1;min-width:0}
.ss-detaildescrow .ss-btn{flex:none}
.ss-detailactions{display:flex;gap:8px;margin-top:10px}
.ss-detailvalnode{display:flex;align-items:center;gap:8px;min-width:0}
.ss-idline{display:inline-flex;align-items:center;gap:6px;min-width:0}
.ss-idtext{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-copyid{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-family:inherit;transition:background .15s ease,color .15s ease}
.ss-copyid:hover{background:var(--ss-surface-hover);color:var(--dsw-alias-label-primary)}
.ss-copyid:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ss-tip{display:inline-flex;align-items:safe center;gap:8px;position:fixed;z-index:100;width:max-content;box-sizing:border-box;max-width:min(50vw,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:3px 7px;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-tooltip-bg,var(--dsw-alias-bg-overlay));color:var(--dsw-static-neutral-bluish-00,#fff);font-size:13px;line-height:20px;white-space:pre-line;overflow-wrap:break-word;pointer-events:none;animation:ss-tip-in .15s var(--ds-ease-in-out,ease)}
@keyframes ss-tip-in{from{opacity:0}}
.ss-others{margin-top:18px}
.ss-others-head{width:100%;display:flex;align-items:center;gap:6px;padding:6px 4px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;font-weight:600;text-align:left;cursor:pointer;border-radius:var(--dsw-radius-md)}
.ss-others-head:hover{color:var(--dsw-alias-label-primary);background:var(--ss-surface-hover,var(--dsw-alias-interactive-bg-hover))}
.ss-others-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ss-othercard{margin-top:4px}
.ss-hint{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:8px;line-height:1.55}
/* --- motion: short fades, within the host's own 150-200ms easing range --- */
@keyframes ss-fade-in{from{opacity:0}to{opacity:1}}
.ss-fade{animation:ss-fade-in .16s ease-out both}
    .ss-sessionssummary{display:flex;align-items:center;flex-wrap:wrap;gap:14px;min-height:32px;margin:2px 2px 12px;font-size:12px;color:var(--dsw-alias-label-secondary)}
    .ss-sessionssummary b{color:var(--dsw-alias-label-primary)}
    .ss-sessioncard{padding:6px 14px 10px}
    .ss-sessioncard .ss-group{margin-bottom:10px}
    .ss-sessioncard .ss-group:last-child{margin-bottom:0}
    .ss-sessioncard .ss-grouphead{padding:12px 2px 8px;margin-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12px}
    .ss-sessioncard .ss-group .ss-row{margin-bottom:6px}
    .ss-sessioncard .ss-group .ss-row:last-child{margin-bottom:0}
    .ss-sessioncard .ss-empty{padding:28px 8px}
    .ss-selectbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
@media (prefers-reduced-motion:reduce){.ss-fade{animation:none}.ss-tip{animation:none}.ss-groupanim{transition:none}.ss-detail-anim,.ss-detail-anim.open,.ss-detail-anim.closing{animation:none;transition:none}.ss-btn,.ss-iconbtn,.ss-copyid,.ss-groupcollapse,.ss-groupcollapse-icon,.ss-tab,.ss-switch,.ss-switch span,.ss-backtop{transition:none}}
/* --- settings page: lives inside the host settings dialog, so the dialog's
   own surface, padding and type scale apply instead of our app-shell layout --- */
.ss-settings{background:transparent;height:auto;overflow:visible;font-size:14px;line-height:22px;--ss-surface:color-mix(in srgb, var(--dsw-alias-label-primary) 6%, var(--dsw-alias-bg-layer-2));--ss-surface-hover:color-mix(in srgb, var(--dsw-alias-label-primary) 11%, var(--dsw-alias-bg-layer-2))}
.ss-settings .ss-page{max-width:none;margin:0;padding:0 0 24px;gap:0}
.ss-settings .ss-settingshead{margin:0 0 14px}
.ss-settings .ss-title{font-size:18px;line-height:26px;font-weight:600;letter-spacing:0;margin:0}
.ss-settings .ss-sub{font-size:13px;line-height:20px;margin-top:4px}
.ss-settings .ss-field{padding:16px 0;gap:24px}
.ss-settings .ss-field:first-of-type{padding-top:6px}
.ss-settings .ss-fieldlabel{font-size:14px;line-height:22px}
.ss-settings .ss-fieldlabel small{font-size:13px;line-height:20px;margin-top:2px;max-width:560px}
.ss-settings .ss-radio{font-size:14px;line-height:22px;gap:9px}
.ss-settings .ss-radio input{width:15px;height:15px}
.ss-settings .ss-card{background:transparent;border:0;border-radius:0;padding:4px 0 0;margin:6px 0 0}
.ss-settings .ss-card h4{font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;margin:0 0 8px;color:var(--dsw-alias-label-secondary)}
.ss-settings .ss-notifycard h4{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ss-settings .ss-kpis{font-size:13px;line-height:22px;gap:10px}
.ss-settings .ss-kpis b{font-weight:600}
.ss-notifyactions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
.ss-notifycard .ss-field:last-of-type{border-bottom:none}
.ss-notifycard .ss-hint{margin-top:8px}
.ss-notifycard .ss-radios{padding:4px 0 2px}
.ss-notifycard .ss-fieldlabel small{color:var(--dsw-alias-label-tertiary)}
.ss-notifycard .ss-hint{color:var(--dsw-alias-label-tertiary)}
.ss-notifyfooter{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 0 6px}
.ss-notifyintro{margin:0 0 10px}
.ss-channelrow{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:6px 0 6px 14px;border-left:1px solid var(--dsw-alias-border-l2)}
.ss-channel{display:flex;align-items:center;gap:10px}
.ss-channellabel{font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.ss-volumewrap{display:flex;align-items:center;gap:10px;min-width:230px}
.ss-volumerange{flex:1;min-width:120px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.ss-volumenum{width:64px;height:28px;padding:0 8px;text-align:right;font-size:12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-sizing:border-box}
.ss-volumenum:focus{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 var(--dsw-focus-ring-width) var(--dsw-focus-ring-color)}
.ss-volumenum:disabled{opacity:.5}
.ss-volumeunit{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.ss-subhead{font-size:12px;line-height:20px;font-weight:400;color:var(--dsw-alias-label-primary);margin:16px 0 2px}
.ss-soundrow{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l1)}
.ss-soundrow+.ss-soundrow{border-top:none}
.ss-notifycard .ss-subhead.ss-tonehead{display:flex;align-items:center;height:58px;box-sizing:border-box;margin:0;padding:10px 0 0;line-height:20px}
.ss-notifycard .ss-behaviorsub{border-top:1px solid var(--dsw-alias-border-l1);margin-top:0;padding-top:18px}
.ss-soundicon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);flex:none}
.ss-soundmain{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.ss-soundlabel{font-size:12px;line-height:20px;color:var(--dsw-alias-label-primary)}
.ss-soundsub{font-size:11px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-soundactions{display:flex;align-items:center;gap:6px;flex:none}
.ss-soundbtn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;cursor:pointer;padding:0}
.ss-soundbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ss-soundbtn:disabled{opacity:.45;cursor:default}
.ss-soundbtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}
.ss-settings .ss-mono{font-size:12px;line-height:18px}
.ss-settings .ss-btn{height:32px;padding:0 14px;font-size:13px;border-radius:8px}
.ss-settings .ss-toolbar{gap:10px;padding-top:4px}
.ss-settings .ss-hint{font-size:12px;line-height:18px;margin-top:10px}
/* --- settings navigation icon. DSH 0.2.2 exposes the keyed slot
   settings.section.icon (id = settings.section id), so the nav glyph is
   registered as slot content instead of being patched into the shell's DOM. --- */
`;

/* ------------------------------------------------------------- primitives */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function resolveLabel(option, t, locale) {
  const label = option?.label;
  if (typeof label === 'function') {
    try {
      const value = label();
      return String(value ?? option.id);
    } catch {
      return String(option.id);
    }
  }
  if (typeof label === 'string') return label;
  if (label && typeof label === 'object') {
    const short = String(locale || '').split('-')[0];
    return String(label[locale] ?? label[short] ?? label.en ?? option.id);
  }
  return String(option?.id ?? '');
}

function cssAttr(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function fmtBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtWhen(value) {
  const time = Number(value) || 0;
  if (!time) return '';
  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '<1m';
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d`;
  return new Date(time).toLocaleDateString();
}

function fmtDate(value) {
  const time = Number(value) || 0;
  if (!time) return '';
  try {
    return new Date(time).toLocaleString();
  } catch {
    return String(time);
  }
}

/* ------------------------------------------------------------------ icons */

function PanelIcon(props) {
  const size = Number(props?.size) || 16;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    React.createElement('rect', { x: 2.5, y: 2.5, width: 19, height: 19, rx: 4.5 }),
    React.createElement('rect', { x: 5.5, y: 14.9, width: 13, height: 3, rx: 1.5 }),
    React.createElement('rect', { x: 7.2, y: 7.9, width: 9.3, height: 3, rx: 1.5 }),
    React.createElement('path', {
      d: 'M18.4 8.1 Q18.4 9.8 20.1 9.8 Q18.4 9.8 18.4 11.5 Q18.4 9.8 16.7 9.8 Q18.4 9.8 18.4 8.1 Z',
      fill: 'currentColor',
      stroke: 'none',
    }),
  );
}

/**
 * Empty-trash illustration: a quiet outline of the can, no fill so it adapts
 * to both themes through currentColor.
 */
function TrashEmptyIcon(props) {
  const size = Number(props?.size) || 40;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M4 6.5h16' }),
    React.createElement('path', { d: 'M9.2 6.5V4.6h5.6v1.9' }),
    React.createElement('path', { d: 'M6.6 6.5l.9 13.2h9l.9-13.2' }),
    React.createElement('path', { d: 'M10.2 10v6' }),
    React.createElement('path', { d: 'M13.8 10v6' }),
  );
}

/** Small chevron used by the sort control, mirroring the host menu anchor. */
function ChevronDownIcon(props) {
  const size = Number(props?.size) || 16;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M6 9.5l6 6 6-6' }),
  );
}

/** Arrow shown by the floating back-to-top button. */
function ArrowUpIcon(props) {
  const size = Number(props?.size) || 16;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.9,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M12 19V5' }),
    React.createElement('path', { d: 'M6 11l6-6 6 6' }),
  );
}

/** Gear shown on the header's settings shortcut. */
function GearIcon(props) {
  const size = Number(props?.size) || 16;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('circle', { cx: 12, cy: 12, r: 3.1 }),
    React.createElement('path', {
      d: 'M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z',
    }),
  );
}

/** Host icon: IconAppsAddOutlineRegular (the sidebar's More launcher glyph). */
function MoreAppsIcon(props) {
  const size = Number(props?.size) || 16;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1,
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('rect', { x: 2.25, y: 2.25, width: 4, height: 4, rx: 1 }),
    React.createElement('rect', { x: 2.25, y: 9.75, width: 4, height: 4, rx: 1 }),
    React.createElement('rect', { x: 9.75, y: 9.75, width: 4, height: 4, rx: 1 }),
    React.createElement('path', { d: 'M11.75 1.75v5M9.25 4.25h5' }),
  );
}

/** Host icon: IconPluginPinwheelOutlineRegular ("Browse other plugins" row). */
function PinwheelIcon(props) {
  const size = Number(props?.size) || 16;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1,
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', {
      d: 'M7.84457 5.06199C11.6605 4.93876 14.7962 6.14848 14.8484 7.76397C14.8875 8.97461 13.1838 10.0696 10.7215 10.5942',
    }),
    React.createElement('path', {
      d: 'M5.12742 8.07731C5.00419 4.26138 6.21391 1.12568 7.8294 1.07351C9.04004 1.03441 10.135 2.73808 10.6596 5.20037',
    }),
    React.createElement('path', {
      d: 'M8.02457 10.6802C4.20865 10.8034 1.07294 9.5937 1.02077 7.97821C0.981678 6.76758 2.68535 5.67262 5.14763 5.14798',
    }),
    React.createElement('path', {
      d: 'M10.7476 7.89535C10.8708 11.7113 9.66109 14.847 8.0456 14.8991C6.83496 14.9382 5.74 13.2346 5.21536 10.7723',
    }),
  );
}

/** Host icon: IconPlusOutlineRegular ("Create your plugin" row). */
function PlusIcon(props) {
  const size = Number(props?.size) || 16;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1,
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M8 2V14' }),
    React.createElement('path', { d: 'M2 8H14' }),
  );
}

/** Check mark shown on the selected row of the sort menu. */
function MenuCheckIcon(props) {
  const size = Number(props?.size) || 14;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M5 12.5l4.5 4.5L19 7.5' }),
  );
}

/** Copy icon used by the "copy panel id" button. */
function CopyIcon(props) {
  const size = Number(props?.size) || 13;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('rect', { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.6 }),
    React.createElement('path', { d: 'M10.5 3.5H4.1A1.6 1.6 0 0 0 2.5 5.1v6.4' }),
  );
}

function NoteIcon(props) {
  const size = Number(props?.size) || 14;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M6.2 11.6V4.4l6-1.2v7.2' }),
    React.createElement('circle', { cx: 4.4, cy: 11.7, r: 1.8 }),
    React.createElement('circle', { cx: 10.4, cy: 10.4, r: 1.8 }),
  );
}

function PlayIcon(props) {
  const size = Number(props?.size) || 12;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M5.4 3.6 12 8l-6.6 4.4z' }),
  );
}

function UploadIcon(props) {
  const size = Number(props?.size) || 12;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M8 10.6V2.8' }),
    React.createElement('path', { d: 'M5.1 5.6 8 2.7l2.9 2.9' }),
    React.createElement('path', { d: 'M3.2 10.2v2.1c0 .5.4.9.9.9h7.8c.5 0 .9-.4.9-.9v-2.1' }),
  );
}

function ResetIcon(props) {
  const size = Number(props?.size) || 12;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'aria-hidden': 'true',
    },
    React.createElement('path', { d: 'M3.4 8a4.6 4.6 0 1 0 1.5-3.4' }),
    React.createElement('path', { d: 'M2.8 2.9v3h3' }),
  );
}

/**
 * DSH-style tooltip. Replaces the browser's native title bubble with the same
 * fixed-position bubble the host app uses (dark tooltip surface, 13px text,
 * 8px radius, 15ms fade) and supports multi-line text via pre-line wrapping.
 */
/**
 * Single source of truth for tooltip geometry (shared by the React Tip component
 * and the native-title bridge): the bubble is centred on the anchored element,
 * sits TIP_GAP pixels above its top edge and flips below when it would be clipped.
 */
const TIP_DELAY = 400;
const TIP_GAP = 10;

function computeTipLayout(anchorRect, bubble) {
  const width = (bubble && bubble.offsetWidth) || 0;
  const height = (bubble && bubble.offsetHeight) || 0;
  const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 0;
  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 0;
  const anchorX = anchorRect ? anchorRect.left + anchorRect.width / 2 : 0;
  let left = anchorX - width / 2;
  left = Math.max(8, Math.min(left, Math.max(8, viewportWidth - width - 8)));
  let side = 'top';
  let top = anchorRect ? anchorRect.top - height - TIP_GAP : 0;
  if (top < 8) {
    side = 'bottom';
    top = anchorRect ? anchorRect.bottom + 10 : 0;
  }
  top = Math.max(8, Math.min(top, Math.max(8, viewportHeight - height - 8)));
  return { left: Math.round(left), top: Math.round(top), side };
}

// Pointer-anchored variant used by hints that should track the cursor (the
// plugin expand/collapse hints): bubble bottom sits TIP_GAP px above the cursor,
// flips below the cursor near the top edge and clamps to the viewport.
function computePointerTipLayout(pointer, bubble) {
  const width = (bubble && bubble.offsetWidth) || 0;
  const height = (bubble && bubble.offsetHeight) || 0;
  const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 0;
  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 0;
  let left = (pointer && pointer.x ? pointer.x : 0) - width / 2;
  left = Math.max(8, Math.min(left, Math.max(8, viewportWidth - width - 8)));
  let side = 'top';
  let top = (pointer && pointer.y ? pointer.y : 0) - height - TIP_GAP;
  if (top < 8) {
    side = 'bottom';
    top = (pointer && pointer.y ? pointer.y : 0) + TIP_GAP;
  }
  top = Math.max(8, Math.min(top, Math.max(8, viewportHeight - height - 8)));
  return { left: Math.round(left), top: Math.round(top), side };
}

function Tip(props) {
  const text = props && props.text;
  const children = props && props.children;
  const delay = Number(props && props.delay) || TIP_DELAY;
  const [open, setOpen] = React.useState(false);
  const [layout, setLayout] = React.useState(null);
  const bubbleRef = React.useRef(null);
  const anchorRef = React.useRef(null);
  const pointerRef = React.useRef(null);
  const timerRef = React.useRef(null);

  const hide = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
    setLayout(null);
  }, []);

  const show = React.useCallback(
    (event) => {
      const target = event && event.currentTarget;
      if (!text || !target) return;
      anchorRef.current = target;
      if (props && props.followPointer && event && typeof event.clientX === 'number') {
        pointerRef.current = { x: event.clientX, y: event.clientY };
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setOpen(true);
      }, delay);
    },
    [delay, text, props],
  );

  const followPointer = React.useCallback(
    (event) => {
      if (!event || typeof event.clientX !== 'number') return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (timerRef.current) clearTimeout(timerRef.current);
      if (open) {
        setOpen(false);
        setLayout(null);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setOpen(true);
      }, delay);
    },
    [delay, open],
  );

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  React.useLayoutEffect(() => {
    if (!open) return undefined;
    const anchor = anchorRef.current;
    const bubble = bubbleRef.current;
    if (!bubble) return undefined;
    if (props && props.followPointer && pointerRef.current) {
      setLayout(computePointerTipLayout(pointerRef.current, bubble));
      return undefined;
    }
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return undefined;
    setLayout(computeTipLayout(anchor.getBoundingClientRect(), bubble));
    return undefined;
  }, [open, text, props]);

  if (!text) return children;

  const anchorPrimitive = React.cloneElement(children, {
    'data-tip': text,
    onMouseEnter: show,
    onMouseMove: props && props.followPointer ? followPointer : undefined,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  if (!open) return anchorPrimitive;

  return React.createElement(
    React.Fragment,
    null,
    anchorPrimitive,
    React.createElement(
      'div',
      {
        ref: bubbleRef,
        className: 'ss-tip',
        role: 'tooltip',
        'data-side': layout ? layout.side : 'top',
        style: layout
          ? { left: layout.left + 'px', top: layout.top + 'px' }
          : { left: '0px', top: '0px', visibility: 'hidden' },
      },
      text,
    ),
  );
}

/**
 * Local UI preferences (sort, path visibility, collapsed groups, session filter).
 * Kept in localStorage so a page reload restores the user's last working view;
 * the host remains the source of truth for sessions and plugins.
 */
const UI_PREFS_KEY = 'dsh-keeper:ui-prefs';

function readUiPrefs() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : {};
  } catch (error) {
    return {};
  }
}

function writeUiPrefs(patch) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const next = { ...readUiPrefs(), ...patch };
    window.localStorage.setItem(UI_PREFS_KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    return null;
  }
}

function readPrefList(key) {
  const value = readUiPrefs()[key];
  return Array.isArray(value) ? value : [];
}

/**
 * Renders another sidebar entry's own glyph from its stored Slot entry: the
 * icon component is the exact function the sidebar itself renders with
 * {size, active}. A local boundary keeps one bad glyph from blanking the page.
 */function PanelGlyph(props) {
  const size = Number(props?.size) || 16;
  const component = props?.component;
  const fallback = React.createElement(PanelIcon, { size });
  const renderable =
    typeof component === 'function' ||
    (component !== null && typeof component === 'object' && Boolean(component.$$typeof));
  if (!renderable) return fallback;
  const Boundary = getIconBoundary();
  return React.createElement(Boundary, { fallback }, React.createElement(component, { size, active: false }));
}

let iconBoundary = null;
function getIconBoundary() {
  if (!iconBoundary) {
    iconBoundary = class extends React.Component {
      constructor(inner) {
        super(inner);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch() {
        /* keep the management panel alive; the generic glyph replaces it */
      }
      render() {
        return this.state.failed ? this.props.fallback : this.props.children;
      }
    };
  }
  return iconBoundary;
}

function Logo(props) {
  const size = Number(props?.size) || 34;
  return React.createElement(
    'span',
    {
      style: {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.round(size * 0.28)}px`,
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--dsw-alias-brand-primary)',
        flex: 'none',
      },
    },
    React.createElement(PanelIcon, { size: Math.round(size * 0.55) }),
  );
}

/* ---------------------------------------------------------------- helpers */

function makeStyles(bridge) {
  return {
    download(fileName, content, mime) {
      const blob = new Blob([content], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName || 'session';
      anchor.rel = 'noopener';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
  };
}

/* ---------------------------------------------------------------- dialogs */

function ConfirmDialog(props) {
  const { t, title, body, confirmLabel, danger, onCancel, onConfirm } = props;
  const cancelRef = React.useRef(null);
  React.useEffect(() => {
    if (cancelRef.current && typeof cancelRef.current.focus === 'function') cancelRef.current.focus();
  }, []);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return React.createElement(
    'div',
    {
      className: 'ss-overlay',
      role: 'presentation',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) onCancel();
      },
    },
    React.createElement(
      'div',
      { className: 'ss-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      React.createElement('h3', null, title),
      React.createElement('p', null, body),
      React.createElement(
        'div',
        { className: 'ss-modalfoot' },
        React.createElement('button', { type: 'button', className: 'ss-btn', onClick: onCancel, ref: cancelRef }, t('cancel')),
        React.createElement(
          'button',
          { type: 'button', className: cx('ss-btn', danger ? 'danger' : 'primary'), onClick: onConfirm },
          confirmLabel || t('confirm'),
        ),
      ),
    ),
  );
}

function ExportDialog(props) {
  const { t, formats, format, fileName, onFormat, onCancel, onConfirm, onSetDefault, busy } = props;
  const cancelRef = React.useRef(null);
  React.useEffect(() => {
    if (cancelRef.current && typeof cancelRef.current.focus === 'function') cancelRef.current.focus();
  }, []);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return React.createElement(
    'div',
    {
      className: 'ss-overlay',
      role: 'presentation',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) onCancel();
      },
    },
    React.createElement(
      'div',
      { className: 'ss-modal ss-exportmodal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('exportDialogTitle') },
      React.createElement('h3', null, t('exportDialogTitle')),
      React.createElement('p', { className: 'ss-dialoghint' }, t('exportDialogHint')),
      React.createElement(
        'div',
        { className: 'ss-formatlist', role: 'radiogroup', 'aria-label': t('exportDialogTitle') },
        formats.map((item) =>
          React.createElement(
            'button',
            {
              key: item.id,
              type: 'button',
              role: 'radio',
              'aria-checked': format === item.id ? 'true' : 'false',
              className: cx('ss-formatrow', format === item.id && 'active'),
              onClick: () => onFormat(item.id),
            },
            React.createElement(
              'span',
              { className: 'ss-formatbody' },
              React.createElement('span', { className: 'ss-formatlabel' }, t(item.labelKey)),
              React.createElement('span', { className: 'ss-formatext' }, t(item.hintKey)),
            ),
            format === item.id ? React.createElement(MenuCheckIcon, { className: 'ss-formatcheck' }) : null,
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'ss-filename' },
        React.createElement('span', { className: 'ss-filenamekey' }, t('exportFileNameLabel')),
        React.createElement('span', { className: 'ss-filenameval', title: fileName }, fileName),
      ),
      React.createElement(
        'div',
        { className: 'ss-modalfoot' },
        React.createElement(
          'button',
          { type: 'button', className: 'ss-btn quiet ss-modalfootstart', onClick: onSetDefault, disabled: busy },
          t('exportSetDefault'),
        ),
        React.createElement('button', { type: 'button', className: 'ss-btn', onClick: onCancel, ref: cancelRef }, t('cancel')),
        React.createElement(
          'button',
          { type: 'button', className: 'ss-btn primary', onClick: onConfirm, disabled: busy },
          busy ? t('exportStart') : t('exportAction'),
        ),
      ),
    ),
  );
}

function Switch(props) {
  const button = React.createElement(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': props.checked ? 'true' : 'false',
      'aria-label': props.label,
      className: 'ss-switch',
      disabled: props.disabled,
      onClick: props.onChange ? () => props.onChange(!props.checked) : undefined,
    },
    React.createElement('span', null),
  );
  if (!props.title) return button;
  return React.createElement(Tip, { text: props.title }, button);
}

/* ------------------------------------------------------- notifications */

const NOTIFY_CURSOR_KEY = 'dsh-keeper:notify-cursor';

function truncateNotifyText(value, max) {
  const text = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const NOTIFY_SOUND_KINDS = ['normal', 'interrupt'];

function normalizeNotifySoundEntry(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return { name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : '' };
}

function normalizeNotifyLastChannels(value, fallback) {
  const raw = value && typeof value === 'object' ? value : null;
  const banner = raw ? raw.banner !== false : fallback.banner;
  const sound = raw ? raw.sound !== false : fallback.sound;
  if (banner || sound) return { banner, sound };
  if (fallback.banner || fallback.sound) return { banner: fallback.banner, sound: fallback.sound };
  return { banner: true, sound: true };
}

function normalizeNotifySettings(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const volume = Number(raw.volume);
  const rawSounds = raw.sounds && typeof raw.sounds === 'object' ? raw.sounds : {};
  const sounds = {};
  NOTIFY_SOUND_KINDS.forEach((kind) => {
    sounds[kind] = normalizeNotifySoundEntry(rawSounds[kind]);
  });
  const rawBanner = raw.system !== false;
  const rawSoundOn = raw.sound !== 'none';
  const lastChannels = normalizeNotifyLastChannels(raw.lastChannels, {
    banner: rawBanner,
    sound: rawSoundOn,
  });
  // The master switch aggregates the two channels: muting it clears both, and
  // turning the last channel off flips it off, so the UI never claims "enabled"
  // while every channel is silent.
  const enabled = raw.enabled !== false;
  const banner = enabled && rawBanner;
  const soundOn = enabled && rawSoundOn;
  return {
    enabled: banner || soundOn,
    // The 提醒事件 card is gone: every task-state event always reminds, the
    // remaining switches only decide the channels and tones.
    onDone: true,
    onError: true,
    onAsk: true,
    system: banner,
    // Banners stay background-only and the in-app toast is just a fallback, so
    // these two are fixed on now that the "提醒方式" card is gone.
    inApp: true,
    unfocusedOnly: true,
    // Older builds stored 'custom' for the synthetic tone; audio is now
    // on/off and the per-group files live under `sounds`.
    sound: soundOn ? 'system' : 'none',
    lastChannels,
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(100, Math.round(volume))) : 100,
    sounds,
    openOnClick: raw.openOnClick !== false,
  };
}

function notifySettingsAreDefault(value) {
  return JSON.stringify(normalizeNotifySettings(value)) === JSON.stringify(normalizeNotifySettings(null));
}

function notifySoundGroup(kind) {
  return kind === 'error' || kind === 'stopped' ? 'interrupt' : 'normal';
}

function notificationPermission() {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission || 'default';
  } catch (error) {
    return 'unsupported';
  }
}

function requestNotificationPermission() {
  try {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    return Promise.resolve(Notification.requestPermission());
  } catch (error) {
    return Promise.resolve('unsupported');
  }
}

function readNotifyCursor() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return window.localStorage.getItem(NOTIFY_CURSOR_KEY) || '';
  } catch (error) {
    return '';
  }
}

function writeNotifyCursor(value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(NOTIFY_CURSOR_KEY, String(value));
  } catch (error) {
    /* best effort */
  }
}

const NOTIFY_EPOCH_KEY = 'dsh-keeper:notify-epoch';

function readNotifyEpoch() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return window.localStorage.getItem(NOTIFY_EPOCH_KEY) || '';
  } catch (error) {
    return '';
  }
}

function writeNotifyEpoch(value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(NOTIFY_EPOCH_KEY, String(value || ''));
  } catch (error) {
    /* best effort */
  }
}

let notifyAudio = null;
let notifyFileAudio = null;

// Peak amplitude of a built-in tone at 100% volume. The cue stays a warm
// two-note sine "ding-dong"; brightness is avoided, so loudness comes from the
// level plus a gentle limiter rather than extra harmonics.
const NOTIFY_TONE_PEAK = 0.8;
let notifyAudioUnlocked = false;

// Chromium keeps a freshly created AudioContext suspended until the page has
// seen a user gesture. Resume on the next interaction so the first reminder
// (often the one that matters) is not silent.
function armNotifyAudioUnlock(audio) {
  if (notifyAudioUnlocked || !audio) return;
  notifyAudioUnlocked = true;
  if (audio.state !== 'suspended' || typeof document === 'undefined') return;
  const unlock = () => {
    try {
      void audio.resume();
    } catch (error) {
      /* ignore */
    }
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}

function playNotifyTone(kind, volume) {
  try {
    const AudioCtor = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AudioCtor) return false;
    const level = Math.max(0, Math.min(1, (Number.isFinite(Number(volume)) ? Number(volume) : 100) / 100));
    if (level <= 0) return false;
    if (!notifyAudio) notifyAudio = new AudioCtor();
    const audio = notifyAudio;
    armNotifyAudioUnlock(audio);

    // One master bus per context: the limiter only catches the overlap of the
    // two notes so the raised level never clips.
    let master = audio.__ssNotifyMaster;
    if (!master) {
      const compressor = audio.createDynamicsCompressor();
      compressor.threshold.value = -3;
      compressor.knee.value = 0;
      compressor.ratio.value = 20;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      master = audio.createGain();
      master.gain.value = 1;
      master.connect(compressor);
      compressor.connect(audio.destination);
      audio.__ssNotifyMaster = master;
    }
    const bus = master;

    const schedule = () => {
      const peak = NOTIFY_TONE_PEAK * level;
      // [frequency, offset seconds, duration seconds] — one shared normal cue for
      // finished and waiting-for-input tasks (the ascending "ding-dong",
      // 660 → 880Hz). "error"/"stopped" deliberately drops into a low, falling
      // two-note motif (F4 → C4, 0.3s total) so an abnormal interruption is
      // audibly different even at low volume: darker register, downward motion.
      // This mirrors the "interrupted" cue of desktop agents.
      const notes =
        kind === 'error' || kind === 'stopped'
          ? [[349.23, 0, 0.12], [261.63, 0.1, 0.2]]
          : [[660, 0, 0.26], [880, 0.14, 0.36]];
      const start = audio.currentTime + 0.02;
      for (const note of notes) {
        playToneNote(audio, bus, note[0], start + note[1], note[2], peak);
      }
    };

    // A suspended context skips notes scheduled in the past, so resume first and
    // only then anchor them to the fresh currentTime — this is what makes the
    // very first notification after page load audible.
    if (audio.state === 'suspended' && typeof audio.resume === 'function') {
      audio.resume().then(schedule, schedule);
    } else {
      schedule();
    }
    return true;
  } catch (error) {
    return false;
  }
}

// A warm "ding": pure sine fundamental with a long exponential decay. No
// octave harmonic, because that reads as a bright electronic beep.
function playToneNote(audio, destination, frequency, start, duration, peak) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, peak), start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

async function playNotificationSound(bridge, kind, settings) {
  const config = normalizeNotifySettings(settings);
  if (config.sound === 'none') return false;
  const group = notifySoundGroup(kind);
  const entry = config.sounds[group];
  notifyDebug(bridge, 'sound-start', {
    kind,
    group,
    volume: config.volume,
    custom: Boolean(entry && entry.name),
    permission: notificationPermission(),
  });
  if (entry && entry.name && bridge && typeof bridge.api === 'function') {
    try {
      const result = await bridge.api('readNotificationSound', { kind: group });
      const data = result && result.data ? result.data : '';
      if (data && typeof Audio !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        const blob = new Blob([bytes], { type: result.mime || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        if (!notifyFileAudio) notifyFileAudio = new Audio();
        notifyFileAudio.pause();
        notifyFileAudio.src = url;
        notifyFileAudio.volume = Math.max(0, Math.min(1, config.volume / 100));
        notifyFileAudio.onended = () => {
          try {
            URL.revokeObjectURL(url);
          } catch (error) {
            /* ignore */
          }
        };
        await notifyFileAudio.play();
        return true;
      }
    } catch (error) {
      /* fall back to the built-in tone */
    }
  }
  const result = playNotifyTone(kind, config.volume);
  notifyDebug(bridge, 'sound-tone', { kind, result });
  return result;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
}

function showDesktopNotification(title, body, tag, onClick) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    // Windows shows its own toast sound by default; we play our own cue, so the
    // native one must stay silent to avoid two sounds at once.
    const notification = new Notification(title, { body: body || '', tag: tag || undefined, silent: true });
    notification.onclick = () => {
      try {
        if (typeof window !== 'undefined' && typeof window.focus === 'function') window.focus();
      } catch (error) {
        /* ignore */
      }
      if (typeof onClick === 'function') onClick();
      try {
        notification.close();
      } catch (error) {
        /* ignore */
      }
    };
    return true;
  } catch (error) {
    return false;
  }
}

function Toast(props) {
  return React.createElement(
    'div',
    {
      className: 'ss-toast',
      role: 'status',
      onMouseEnter: props.onMouseEnter,
      onMouseLeave: props.onMouseLeave,
      onFocus: props.onMouseEnter,
      onBlur: props.onMouseLeave,
    },
    React.createElement('span', null, props.text),
    props.actionLabel
      ? React.createElement(
          'span',
          { className: 'ss-undoaction' },
          React.createElement(
            'button',
            { type: 'button', className: 'ss-undobtn', onClick: props.onAction },
            props.actionLabel,
          ),
        )
      : null,
  );
}

/* ------------------------------------------------------------- main panel */

// Height-animated show/hide, used by the notification tab so the volume and
// tone block slides exactly like a plugin detail panel. Height is measured from
// the content, transitioned, then released to `auto` to stay correct on resize.
const COLLAPSE_ANIM_MS = 280;

function Collapse(props) {
  const open = props.open === true;
  const contentRef = React.useRef(null);
  const timerRef = React.useRef(0);
  const rafRef = React.useRef(0);
  const firstRef = React.useRef(true);
  const [height, setHeight] = React.useState(open ? 'auto' : 0);

  React.useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    if (firstRef.current) {
      firstRef.current = false;
      setHeight(open ? 'auto' : 0);
      return undefined;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (open) {
      setHeight(0);
      // Two frames: the first commits the closed height, the second flips to the
      // measured height so the transition always starts from 0.
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setHeight(content.offsetHeight);
          timerRef.current = setTimeout(() => setHeight('auto'), COLLAPSE_ANIM_MS);
        });
      });
      return undefined;
    }
    setHeight(content.offsetHeight);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setHeight(0));
    });
    return undefined;
  }, [open]);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return React.createElement(
    'div',
    {
      className: 'ss-collapse',
      'aria-hidden': open ? undefined : 'true',
      style: {
        height: height === 'auto' ? 'auto' : `${height}px`,
        overflow: 'hidden',
        transition: `height ${COLLAPSE_ANIM_MS - 20}ms cubic-bezier(.2,0,0,1)`,
        pointerEvents: open ? undefined : 'none',
      },
    },
    React.createElement('div', { ref: contentRef }, props.children),
  );
}

/* ------------------------------------------------------- notification loop */

// The reminder loop has to live outside the main panel: that panel is only
// mounted while the DSH Keeper page is open, but notifications must arrive
// while the user is chatting in a conversation. One loop per page load.
let notifierStarted = false;

// Fire-and-forget diagnostics: the host appends these to
// ~/.dsh/storages/dsh-keeper/notify-debug.log so a missing reminder can be
// traced without opening devtools.
function notifyDebug(bridge, message, data) {
  try {
    if (!bridge || typeof bridge.api !== 'function') return;
    const pending = bridge.api('debugLog', { message, data });
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch (error) {
    /* ignore */
  }
}

function startNotifier(bridge, t) {
  if (notifierStarted) return () => {};
  notifierStarted = true;
  let alive = true;
  let timer = null;
  let cursor = readNotifyCursor();
  let epoch = readNotifyEpoch();
  let seen = epoch !== '';
  let staleWarned = false;
  let pollCount = 0;
  notifyDebug(bridge, 'notifier-start', {
    cursor,
    epoch,
    permission: notificationPermission(),
  });

  const openSession = (sessionId) => {
    try {
      if (typeof window !== 'undefined' && typeof window.focus === 'function') window.focus();
    } catch (error) {
      /* ignore */
    }
    if (sessionId && bridge && typeof bridge.openSession === 'function') {
      try {
        bridge.openSession(sessionId);
      } catch (error) {
        /* ignore */
      }
    }
  };

  const showInApp = (text) => {
    try {
      if (typeof document === 'undefined' || !document.body) return;
      let node = document.getElementById('ss-global-toast');
      if (!node) {
        node = document.createElement('div');
        node.id = 'ss-global-toast';
        node.className = 'ss-global-toast';
        node.setAttribute('role', 'status');
        document.body.appendChild(node);
      }
      node.textContent = text;
      node.classList.add('ss-global-toast-open');
      clearTimeout(node.__ssTimer);
      node.__ssTimer = setTimeout(() => node.classList.remove('ss-global-toast-open'), 4600);
    } catch (error) {
      /* ignore */
    }
  };

  const poll = async () => {
    if (!alive) return;
    try {
      let value = await bridge.api('notifications', { after: cursor || '0' });
      if (!alive || !value) return;
      pollCount += 1;
      if (pollCount === 1) {
        notifyDebug(bridge, 'poll-first', {
          after: cursor || '0',
          latest: String(value.latest || ''),
          epoch: String(value.epoch || ''),
          count: Array.isArray(value.items) ? value.items.length : 0,
        });
      }
      const hostEpoch = String(value.epoch || '');
      // A stored cursor without an epoch came from an older build: the host may
      // have restarted since, so treat it as stale instead of trusting it.
      const epochChanged = hostEpoch !== '' && (epoch ? hostEpoch !== epoch : Boolean(cursor));
      if (epochChanged) {
        // The host restarted: its notification sequence starts at zero again,
        // so a cursor kept from the previous process would hide every new item.
        seen = true;
        cursor = '';
        writeNotifyCursor('');
        value = await bridge.api('notifications', { after: '0' });
        if (!alive || !value) return;
      }
      if (hostEpoch) {
        if (epoch !== hostEpoch) writeNotifyEpoch(hostEpoch);
        epoch = hostEpoch;
      }
      const latest = String(value.latest || '0');
      const items = Array.isArray(value.items) ? value.items : [];
      if (!cursor && !seen) {
        // First connection: remember the cursor without replaying history.
        seen = true;
        cursor = latest;
        writeNotifyCursor(latest);
        return;
      }
      seen = true;
      const settings = normalizeNotifySettings(value.settings);
      const focused =
        typeof document !== 'undefined' && typeof document.hasFocus === 'function' && document.hasFocus();
      if (items.length > 0) {
        notifyDebug(bridge, 'poll-items', {
          count: items.length,
          ids: items.map((item) => (item && item.id) || ''),
          kinds: items.map((item) => (item && item.kind) || ''),
          enabled: settings.enabled,
          onAsk: settings.onAsk,
          onDone: settings.onDone,
          sound: settings.sound,
          focused,
        });
      }
      let newest = cursor;
      for (const item of items) {
        if (!item || !item.id) continue;
        if (Number(item.id) > Number(newest)) newest = String(item.id);
        if (!settings.enabled) continue;
        const kind = item.kind;
        if (kind === 'done' && !settings.onDone) continue;
        // Interrupted turns belong to the "task failed" switch: both use the same
        // low falling tone and the same hint（出错或中断时提醒）.
        if ((kind === 'error' || kind === 'stopped') && !settings.onError) continue;
        if (kind === 'ask' && !settings.onAsk) continue;
        if (kind !== 'done' && kind !== 'error' && kind !== 'ask' && kind !== 'stopped') continue;
        const metaTitle = truncateNotifyText(item.title, 60) || t('notifyUntitled');
        const suffix =
          kind === 'done'
            ? t('notifyDoneSuffix')
            : kind === 'error'
              ? t('notifyErrorSuffix')
              : kind === 'stopped'
                ? t('notifyStoppedSuffix')
                : t('notifyAskSuffix');
        const title = truncateNotifyText(`${suffix} · ${metaTitle}`, 48);
        const detail = String(item.detail || '').trim();
        // Body = task summary (max 100 chars). Only when a session has no
        // assistant answer yet do we fall back to the action hint.
        const summary = truncateNotifyText(item.summary, 100);
        let body = summary;
        if (!body) {
          if (kind === 'error') {
            const detailSummary = truncateNotifyText(detail, 80);
            body = detailSummary
              ? t('notifyErrorBody').replace('{detail}', detailSummary)
              : t('notifyErrorBodyPlain');
          } else if (kind === 'ask') {
            const questionCount = Number(item.questionCount) || 0;
            if (item.approval || detail === 'approval') {
              body = t('notifyAskApprovalBody');
            } else if (questionCount > 0) {
              body = t('notifyAskQuestionsBody').replace('{n}', String(questionCount));
            } else {
              body = t('notifyAskGenericBody');
            }
          } else if (kind === 'stopped') {
            body = t('notifyStoppedBody');
          } else {
            body = t('notifyDoneBody');
          }
        }
        // Focused window: sound only. A toast on top of the window the user is
        // already looking at is noise; the desktop banner is reserved for the
        // unfocused / background case.
        const allowDesktop = settings.system && (!settings.unfocusedOnly || !focused);
        const delivered =
          allowDesktop &&
          showDesktopNotification(title, body, item.sessionId || item.id, () => {
            if (settings.openOnClick) openSession(item.sessionId);
          });
        notifyDebug(bridge, 'deliver', {
          id: item.id,
          kind,
          allowDesktop,
          delivered,
          inApp: settings.inApp,
          focused,
          unfocusedOnly: settings.unfocusedOnly,
          system: settings.system,
          title,
        });
        if (!delivered && settings.inApp && !focused) showInApp(title + (body ? '：' + body : ''));
        if (settings.sound !== 'none') void playNotificationSound(bridge, kind, settings);
      }
      if (newest !== cursor) {
        cursor = newest;
        writeNotifyCursor(newest);
      }
    } catch (error) {
      notifyDebug(bridge, 'poll-error', { message: String((error && error.message) || error) });
      // The host may still be the previous build (no notifications API). Say so
      // once instead of failing silently, because that looks like "no reminders".
      if (!staleWarned) {
        staleWarned = true;
        showInApp(t('notifyHostStale'));
      }
    }
  };
  void poll();
  timer = setInterval(poll, 2000);
  return () => {
    alive = false;
    notifierStarted = false;
    if (timer) clearInterval(timer);
  };
}

/**
 * `bootstrap` decodes every session log on the host's first call, so keep the
 * last snapshot at module level: re-entering the panel paints instantly and the
 * background poll refreshes it (stale-while-revalidate). `apply()` warms the
 * same promise at startup, which also feeds the hidden-panel CSS.
 */
let bootstrapCache = null;
let bootstrapInflight = null;

function readBootstrapCache() {
  return bootstrapCache;
}

function loadBootstrap(bridge, options) {
  const force = options?.force === true;
  if (!force && bootstrapCache) return Promise.resolve(bootstrapCache);
  if (bootstrapInflight) return bootstrapInflight;
  bootstrapInflight = bridge
    .api('bootstrap', {})
    .then((value) => {
      bootstrapCache = value;
      bootstrapInflight = null;
      return value;
    })
    .catch((error) => {
      bootstrapInflight = null;
      throw error;
    });
  return bootstrapInflight;
}

/** Layout-identical placeholder so a cold bootstrap never flashes an empty page. */
function BootstrapSkeleton() {
  return React.createElement(
    'div',
    { className: 'ss-pane ss-pane-main ss-skeleton', 'aria-busy': 'true' },
    React.createElement(
      'div',
      { className: 'ss-skelmeta' },
      React.createElement('span', { className: 'ss-skel ss-skel-line', style: { width: 78 } }),
      React.createElement('span', { className: 'ss-skel ss-skel-line', style: { width: 44 } }),
    ),
    React.createElement('div', { className: 'ss-skel ss-skel-group' }),
    [0, 1, 2].map((index) =>
      React.createElement(
        'div',
        { key: index, className: 'ss-skelrow' },
        React.createElement('span', { className: 'ss-skel ss-skel-circle' }),
        React.createElement(
          'span',
          { className: 'ss-skellines' },
          React.createElement('span', {
            className: 'ss-skel ss-skel-line',
            style: { width: index === 1 ? '46%' : '58%' },
          }),
          React.createElement('span', {
            className: 'ss-skel ss-skel-line small',
            style: { width: '34%' },
          }),
        ),
      ),
    ),
  );
}

function MainPanel(props) {
  const { t, bridge } = props;
  // Paint the last snapshot immediately (stale-while-revalidate) instead of an
  // empty page: bootstrap decodes every session log on the host's first call.
  const [boot, setBoot] = React.useState(() => readBootstrapCache());
  const [loadError, setLoadError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState('sessions');
  const [query, setQuery] = React.useState('');
  const [panelQuery, setPanelQuery] = React.useState('');
  const [scopeFilter, setScopeFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [copiedId, setCopiedId] = React.useState(null);
  const [othersOpen, setOthersOpen] = React.useState(false);
  const [showBackTop, setShowBackTop] = React.useState(false);
  const rootRef = React.useRef(null);
  const panelsListRef = React.useRef(null);
  const paneRef = React.useRef(null);
  const [sort, setSort] = React.useState(() => {
    const value = readUiPrefs().sort;
    return value === 'size' || value === 'title' ? value : 'updated';
  });
  const [sortOpen, setSortOpen] = React.useState(false);
  const [visiblePaths, setVisiblePaths] = React.useState(() => new Set(readPrefList('visiblePaths')));
  const [collapsedGroups, setCollapsedGroups] = React.useState(() => new Set(readPrefList('collapsedGroups')));
  const [closingGroups, setClosingGroups] = React.useState(() => new Set());
  const groupTimersRef = React.useRef(new Map());
  const groupNodeRefs = React.useRef(new Map());
  const openingGroupsRef = React.useRef(new Set());
  const [sessionStatusFilter, setSessionStatusFilter] = React.useState(() => {
    const value = readUiPrefs().sessionStatusFilter;
    return value === 'running' || value === 'archived' || value === 'blank' ? value : 'all';
  });
  const [selected, setSelected] = React.useState(() => new Set());
  const [toast, setToast] = React.useState(null);
  // Hovering (or focusing) an undo toast pauses its dismissal timer; moving the
  // pointer away restarts the full 5s window.
  const [toastHovered, setToastHovered] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const [reloadKey, setReloadKey] = React.useState(0);
  const bootJsonRef = React.useRef('');
  const [hidden, setHidden] = React.useState(() => new Set());
  const [inventory, setInventory] = React.useState(null);
  const [expandedPanels, setExpandedPanels] = React.useState(() => new Set());
  // Collapsing keeps the detail block mounted for one short transition so the
  // grid row can animate from 1fr to 0fr before the node is removed.
  const [closingDetails, setClosingDetails] = React.useState(() => new Set());
  const detailTimersRef = React.useRef(new Map());
  const detailNodeRefs = React.useRef(new Map());
  // Sidebar panels that were seen while enabled: when a plugin is disabled at
  // runtime its sidebar registration disappears, so we remember the row and
  // keep offering "Enable" right where the user disabled it.
  const panelMemoryRef = React.useRef(
    new Map(Object.entries((bridge && bridge.panelMemory) || {})),
  );
  const panelMemoryJsonRef = React.useRef('');
  const [translations, setTranslations] = React.useState({});
  const [exportTarget, setExportTarget] = React.useState(null);
  const [exportFormat, setExportFormat] = React.useState('md');
  const toastTimer = React.useRef(null);
  const [notifyPermission, setNotifyPermission] = React.useState(() => notificationPermission());
  const [notifyBusy, setNotifyBusy] = React.useState(false);
  const notifyFileRef = React.useRef(null);
  const pendingSoundGroupRef = React.useRef('normal');
  const notifySaveTimerRef = React.useRef(null);

  const refresh = () => setReloadKey((key) => key + 1);

  React.useEffect(() => {
    writeUiPrefs({ sort });
  }, [sort]);

  React.useEffect(() => {
    writeUiPrefs({ visiblePaths: [...visiblePaths] });
  }, [visiblePaths]);

  React.useEffect(() => {
    writeUiPrefs({ collapsedGroups: [...collapsedGroups] });
  }, [collapsedGroups]);

  React.useEffect(() => {
    writeUiPrefs({ sessionStatusFilter });
  }, [sessionStatusFilter]);

  React.useEffect(() => {
    let alive = true;
    let timer = null;
    const load = async () => {
      try {
        const value = await loadBootstrap(bridge, { force: true });
        if (!alive) return;
        const json = JSON.stringify(value);
        // Only re-render when the snapshot actually changed: the 8s poll must
        // not re-paint an idle page.
        if (json !== bootJsonRef.current) {
          bootJsonRef.current = json;
          setBoot(value);
          setHidden(new Set(value?.state?.hiddenPanels ?? []));
        }
        setLoadError(null);
      } catch (error) {
        if (alive) setLoadError(error?.message || String(error));
      }
    };
    const start = () => {
      if (timer) return;
      void load();
      timer = setInterval(load, 8000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    // Poll only while the window is visible: a background tab does not need a
    // refresh every 8 seconds, and coming back triggers an immediate reload.
    const sync = () => {
      if (typeof document !== 'undefined' && document.hidden) stop();
      else start();
    };
    sync();
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', sync);
    }
    return () => {
      alive = false;
      stop();
      if (typeof document !== 'undefined' && document.removeEventListener) {
        document.removeEventListener('visibilitychange', sync);
      }
    };
  }, [reloadKey]);

  const notifySettings = normalizeNotifySettings(
    boot && boot.state && boot.state.settings ? boot.state.settings.notifications : null,
  );

  const notifyOpenSession = (sessionId) => {
    try {
      if (typeof window !== 'undefined' && typeof window.focus === 'function') window.focus();
    } catch (error) {
      /* ignore */
    }
    if (sessionId && bridge && typeof bridge.openSession === 'function') {
      try {
        bridge.openSession(sessionId);
      } catch (error) {
        /* ignore */
      }
    }
  };


  React.useEffect(() => {
    const bump = () => setTick((value) => value + 1);
    const off = bridge.subscribePanels(bump);
    return () => {
      try {
        if (typeof off === 'function') off();
      } catch {
        /* ignore */
      }
    };
  }, []);

  React.useEffect(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (!toast) {
      if (toastHovered) setToastHovered(false);
      return undefined;
    }
    if (toastHovered) return undefined;
    toastTimer.current = setTimeout(() => setToast(null), toast.undoValue ? 5000 : 4200);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast, toastHovered]);

  const panels = React.useMemo(() => bridge.listPanels(), [tick]);

  React.useEffect(() => {
    if (tab !== 'panels') return undefined;
    let alive = true;
    const fallback = () => bridge.api('pluginInventory', {});
    bridge
      .api('pluginScopes', {})
      .catch(fallback)
      .then((value) => {
        if (alive) setInventory(value && Array.isArray(value.items) ? value : { supported: false, items: [] });
      })
      .catch(() => {
        if (alive) setInventory({ supported: false, items: [] });
      });
    return () => {
      alive = false;
    };
  }, [tab, reloadKey, tick]);

  React.useEffect(() => {
    bridge.applyHide([...hidden], panels);
  }, [hidden, panels, tick]);

  const settings = boot?.state?.settings ?? { defaultDeleteMode: 'trash', confirmPurge: true };

  const sessions = React.useMemo(() => {
    const out = [];
    for (const workspace of boot?.workspaces ?? []) {
      for (const session of workspace.sessions ?? []) {
        out.push({
          ...session,
          workspaceId: workspace.id,
          workspaceTitle: workspace.title,
          workspacePath: workspace.path,
        });
      }
    }
    return out;
  }, [boot]);

  const totalSize = sessions.reduce((sum, session) => sum + (Number(session.sizeBytes) || 0), 0);
  const runningCount = sessions.filter((session) => session.running).length;

  const trash = boot?.trash ?? [];
  const trashSize = trash.reduce((sum, entry) => sum + (Number(entry.sizeBytes) || 0), 0);

  // Status filter mirrors the plugin manager: one chip narrows the list without
  // changing which sessions exist, so bulk actions stay scoped to the filter.
  const sessionStatusMatches = (session) => {
    if (sessionStatusFilter === 'all') return true;
    if (sessionStatusFilter === 'running') return session.running === true;
    if (sessionStatusFilter === 'archived') return session.archived === true;
    return session.blank === true;
  };

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const searched = needle
      ? sessions.filter((session) => {
          // Search both the raw workspace title and the localized alias, so
          // typing 默认 works even though the host title is default-workspace.
          const workspaceAlias =
            session.workspaceTitle === 'default-workspace' ? t('defaultWorkspace') : '';
          const haystack =
            `${session.title} ${session.workspaceTitle} ${workspaceAlias} ${session.workspacePath}`.toLowerCase();
          return haystack.includes(needle);
        })
      : sessions.slice();
    const filtered = searched.filter(sessionStatusMatches);
    filtered.sort((a, b) => {
      if (sort === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      if (sort === 'title') return String(a.title).localeCompare(String(b.title));
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return filtered;
  }, [sessions, query, sort, sessionStatusFilter]);

  const groups = React.useMemo(() => {
    const map = new Map();
    for (const session of visible) {
      const key = session.workspaceId || session.workspaceTitle;
      if (!map.has(key)) {
        map.set(key, {
          id: session.workspaceId,
          title: session.workspaceTitle || t('unknownWorkspace'),
          path: session.workspacePath || '',
          sessions: [],
        });
      }
      map.get(key).sessions.push(session);
    }
    return [...map.values()];
  }, [visible]);

  // Every session, largest log first; the card scrolls once the list outgrows
  // its visible height, so nothing is silently dropped at five items.
  const topSizes = React.useMemo(
    () => sessions.slice().sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0)),
    [sessions],
  );

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectMany = (ids) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  };

  const unselectMany = (ids) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const groupAllSelected = (group) =>
    group.sessions.length > 0 && group.sessions.every((session) => selected.has(session.id));

  const saveHidden = async (next) => {
    setHidden(next);
    bridge.applyHide([...next], panels);
    try {
      const value = await bridge.api('setHiddenPanels', { hiddenPanels: [...next] });
      setBoot((prev) => (prev ? { ...prev, state: { ...prev.state, hiddenPanels: [...next] } } : prev));
      if (value?.state) setHidden(new Set(value.state.hiddenPanels ?? []));
      setToast({ text: t('panelsSaved') });
    } catch (error) {
      setToast({ text: error?.message || String(error) });
      refresh();
    }
  };

  const run = async (work, message) => {
    setBusy(true);
    try {
      const text = await work();
      if (text) setToast({ text });
      refresh();
    } catch (error) {
      setToast({ text: error?.message || String(error) });
    } finally {
      setBusy(false);
    }
  };

  const trashSessions = (ids) =>
    run(async () => {
      const result = await bridge.api('deleteSessions', { sessionIds: ids, mode: 'trash' });
      const done = (result?.done ?? []).filter((item) => !item.detachedOnly).map((item) => item.sessionId);
      const errors = result?.errors ?? [];
      setSelected(new Set());
      if (errors.length > 0) {
        setToast({ text: errors[0].message });
        return '';
      }
      if (done.length === 0) return '';
      setToast({
        text: t('movedToTrash').replace('{n}', String(done.length)),
        undoValue: { kind: 'restore', ids: done },
      });
      return '';
    });

  const archiveSessions = (ids) =>
    run(async () => {
      const result = await bridge.api('archiveSessions', { sessionIds: ids });
      const done = (result?.done ?? []).map((item) => item.sessionId);
      setSelected(new Set());
      if (done.length === 0) return '';
      setToast({
        text: t('archivedMsg').replace('{n}', String(done.length)),
        undoValue: { kind: 'unarchive', ids: done },
      });
      return '';
    });

  const undo = async () => {
    const value = toast?.undoValue;
    if (!value || busy) return;
    setToast(null);
    if (value.kind === 'notify') {
      setBusy(true);
      try {
        await bridge.api('saveSettings', { settings: { notifications: value.settings } });
        setBoot((previous) =>
          previous
            ? {
                ...previous,
                state: {
                  ...previous.state,
                  settings: {
                    ...((previous.state && previous.state.settings) || {}),
                    notifications: value.settings,
                  },
                },
              }
            : previous,
        );
        setToast({ text: t('notifyUndone') });
      } catch (error) {
        setToast({ text: error?.message || String(error) });
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const method = value.kind === 'unarchive' ? 'unarchiveSessions' : 'restoreSessions';
      const result = await bridge.api(method, { sessionIds: value.ids });
      const done = (result?.done ?? []).length;
      setToast({ text: t('restoredMsg').replace('{n}', String(done)) });
      refresh();
    } catch (error) {
      setToast({ text: error?.message || String(error) });
    } finally {
      setBusy(false);
    }
  };

  const restoreFromTrash = (ids) =>
    run(async () => {
      const result = await bridge.api('restoreSessions', { sessionIds: ids });
      const done = (result?.done ?? []).length;
      const errors = result?.errors ?? [];
      setSelected(new Set());
      if (done === 0) return errors[0]?.message ?? '';
      setToast({ text: t('restoredMsg').replace('{n}', String(done)) });
      return '';
    });

  const purgeFromTrash = (ids) => {
    const rows = trash.filter((entry) => ids.includes(entry.sessionId));
    const size = rows.reduce((sum, entry) => sum + (Number(entry.sizeBytes) || 0), 0);
    const runPurge = () =>
      run(async () => {
        const result = await bridge.api('purgeSessions', { sessionIds: ids });
        const done = (result?.done ?? []).length;
        setSelected(new Set());
        return t('purgedMsg').replace('{n}', String(done));
      });
    if (!settings.confirmPurge) {
      void runPurge();
      return;
    }
    setConfirm({
      title: t('confirmPurgeTitle'),
      body: t('confirmPurgeBody').replace('{n}', String(rows.length)).replace('{size}', fmtBytes(size)),
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await runPurge();
      },
    });
  };

  const emptyTrash = () => {
    if (trash.length === 0) return;
    setConfirm({
      title: t('confirmEmptyTitle'),
      body: t('confirmEmptyBody').replace('{n}', String(trash.length)).replace('{size}', fmtBytes(trashSize)),
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await run(async () => {
          const result = await bridge.api('emptyTrash', {});
          const done = (result?.done ?? []).length;
          return t('purgedMsg').replace('{n}', String(done));
        });
      },
    });
  };

  const cleanBlank = () =>
    run(async () => {
      const result = await bridge.api('cleanBlankSessions', {});
      const done = (result?.done ?? []).filter((item) => !item.detachedOnly).map((item) => item.sessionId);
      const errors = result?.errors ?? [];
      if (errors.length > 0) return errors[0].message;
      if (done.length === 0) return '';
      setToast({
        text: t('cleanedMsg').replace('{n}', String(done.length)),
        undoValue: { kind: 'restore', ids: done },
      });
      return '';
    });

  const blankSessions = React.useMemo(
    () => sessions.filter((session) => session.blank && !session.archived && !session.running),
    [sessions],
  );

  const askCleanBlank = () => {
    if (blankSessions.length === 0) return;
    setConfirm({
      title: t('cleanBlankConfirmTitle'),
      body: t('cleanBlankConfirmBody').replace('{n}', String(blankSessions.length)),
      onConfirm: async () => {
        setConfirm(null);
        await cleanBlank();
      },
    });
  };

  const groupKeyOf = (group) => String(group.id || group.title || '');
  // The built-in default workspace is titled "default-workspace" by the host;
  // in the Chinese UI show its localized name and keep the raw title on hover.
  const isChineseUi = () => {
    const language = String((bridge && bridge.getLocaleId && bridge.getLocaleId()) || '').toLowerCase();
    return language.indexOf('zh') === 0;
  };
  const workspaceDisplayName = (group) => {
    const title = String((group && group.title) || '');
    if (title === 'default-workspace' && isChineseUi()) return t('defaultWorkspace');
    return title;
  };

  const toggleGroupPath = (key) => {
    setVisiblePaths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const GROUP_ANIM_MS = 280;
  const clearGroupTimer = (key) => {
    const timer = groupTimersRef.current.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      groupTimersRef.current.delete(key);
    }
  };
  const finishGroupClose = (key) => {
    clearGroupTimer(key);
    groupNodeRefs.current.delete(key);
    setClosingGroups((previous) => {
      if (!previous.has(key)) return previous;
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
    setCollapsedGroups((previous) => {
      if (previous.has(key)) return previous;
      return new Set(previous).add(key);
    });
  };
  const openGroupBody = (key) => {
    clearGroupTimer(key);
    openingGroupsRef.current.add(key);
    setClosingGroups((previous) => {
      if (!previous.has(key)) return previous;
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
    setCollapsedGroups((previous) => {
      if (!previous.has(key)) return previous;
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
    const node = groupNodeRefs.current.get(key);
    if (node && node.style && node.style.height) {
      // Re-open interrupted a running collapse: interpolate from the current
      // height back up instead of snapping to the full height.
      node.style.height = `${node.getBoundingClientRect().height}px`;
      void node.offsetHeight;
      node.style.height = `${node.scrollHeight}px`;
      groupTimersRef.current.set(key, setTimeout(() => {
        groupTimersRef.current.delete(key);
        if (groupNodeRefs.current.get(key) === node && node.style) node.style.height = '';
      }, GROUP_ANIM_MS + 400));
    }
  };
  const closeGroupBody = (key) => {
    clearGroupTimer(key);
    openingGroupsRef.current.delete(key);
    const node = groupNodeRefs.current.get(key);
    if (node && node.style && typeof node.getBoundingClientRect === 'function') {
      node.style.height = `${node.getBoundingClientRect().height}px`;
      void node.offsetHeight;
      node.style.height = '0px';
    }
    setClosingGroups((previous) => {
      if (previous.has(key)) return previous;
      return new Set(previous).add(key);
    });
    const timer = setTimeout(() => finishGroupClose(key), node ? GROUP_ANIM_MS + 900 : GROUP_ANIM_MS);
    groupTimersRef.current.set(key, timer);
  };
  const toggleGroupCollapsed = (key) => {
    if (collapsedGroups.has(key) || closingGroups.has(key)) {
      openGroupBody(key);
      return;
    }
    closeGroupBody(key);
  };

  const openWorkspacePath = async (workspacePath) => {
    try {
      await bridge.api('openWorkspacePath', { path: workspacePath });
    } catch (error) {
      const message = error?.message || String(error);
      setToast({ text: /Unknown method|NOT_FOUND/i.test(message) ? t('openPathRestart') : message });
    }
  };

  const openSessionSafe = async (sessionId) => {
    const opened = await bridge.openSession(sessionId);
    if (!opened) setToast({ text: t('openSessionFailed') });
  };

  const EXPORT_FORMATS = [
    { id: 'md', labelKey: 'exportFormatMd', hintKey: 'exportFormatMdHint' },
    { id: 'txt', labelKey: 'exportFormatTxt', hintKey: 'exportFormatTxtHint' },
    { id: 'html', labelKey: 'exportFormatHtml', hintKey: 'exportFormatHtmlHint' },
    { id: 'jsonl', labelKey: 'exportFormatJsonl', hintKey: 'exportFormatJsonlHint' },
    { id: 'zstd', labelKey: 'exportFormatZstd', hintKey: 'exportFormatZstdHint' },
  ];

  const defaultExportFormat = () => {
    const settings = boot && boot.state && boot.state.settings ? boot.state.settings : {};
    return EXPORT_FORMATS.some((item) => item.id === settings.defaultExportFormat)
      ? settings.defaultExportFormat
      : 'md';
  };

  const exportExtension = (format) => (format === 'zstd' ? 'jsonl.zstd' : format);

  const exportFileNameFor = (session, format) => {
    const ms = session && typeof session.updatedAt === 'number' ? session.updatedAt : Date.now();
    const date = new Date(ms);
    const pad = (value) => String(value).padStart(2, '0');
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const safe = String((session && session.title) || '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .replace(/[_\s]+/g, '_')
      .replace(/^[_\s.]+|[_\s.]+$/g, '')
      .slice(0, 80);
    const shortId = String((session && session.id) || '').replace(/^session-/, '').slice(0, 8);
    return `${day}_${safe || t('exportUntitled')}_${shortId}.${exportExtension(format)}`;
  };

  // The host advertises the formats it can render. A host that predates this
  // menu returns no list, so the client refuses to open the dialog instead of
  // downloading a file whose name and body disagree.
  const hostExportFormats = () => (boot && Array.isArray(boot.exportFormats) ? boot.exportFormats : []);
  const hostExportReady = () => hostExportFormats().length > 0;

  const openExport = (session) => {
    if (!hostExportReady()) {
      setToast({ text: t('exportHostRestart') });
      return;
    }
    setExportTarget(session);
    setExportFormat(defaultExportFormat());
  };

  const saveExportDefault = async () => {
    if (!exportFormat) return;
    setBusy(true);
    try {
      const saved = await bridge.api('saveSettings', { settings: { defaultExportFormat: exportFormat } });
      const persisted = saved && saved.state && saved.state.settings
        ? saved.state.settings.defaultExportFormat
        : undefined;
      if (persisted !== exportFormat) {
        setToast({ text: t('exportDefaultRestart') });
        return;
      }
      setBoot((previous) => (previous
        ? {
            ...previous,
            state: {
              ...previous.state,
              settings: {
                ...(previous.state && previous.state.settings ? previous.state.settings : {}),
                defaultExportFormat: exportFormat,
              },
            },
          }
        : previous));
      const option = EXPORT_FORMATS.find((item) => item.id === exportFormat);
      setToast({ text: t('exportDefaultSaved').replace('{name}', option ? t(option.labelKey) : exportFormat) });
    } catch (error) {
      setToast({ text: error?.message || String(error) });
    } finally {
      setBusy(false);
    }
  };

  const runExport = async () => {
    const target = exportTarget;
    if (!target) return;
    setBusy(true);
    try {
      const value = await bridge.api('exportSession', {
        sessionId: target.id,
        format: exportFormat,
        title: target.title,
        updatedAt: target.updatedAt,
      });
      if (!value || value.format !== exportFormat) {
        setToast({ text: t('exportHostRestart') });
        return;
      }
      let content = value.content != null ? value.content : '';
      if (value.encoding === 'base64') {
        const binary = atob(String(content));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        content = bytes;
      }
      const fileName = exportFileNameFor(target, exportFormat);
      bridge.download(fileName, content, value.mime || 'application/octet-stream');
      setExportTarget(null);
      setToast({ text: t('exportDone') });
    } catch (error) {
      setToast({ text: error?.message || String(error) });
    } finally {
      setBusy(false);
    }
  };

  const openSettings = () => {
    /* The settings modal is owned by the host shell. The bridge resolves the
       owner store first and falls back to the host's own trigger button; only
       when both are unavailable do we point at the page instead. */
    if (bridge && typeof bridge.openSettings === 'function' && bridge.openSettings()) return;
    setToast({ text: t('settingsHint') });
  };

  const workspaceIds = (workspace) => (workspace.sessions ?? []).map((session) => session.id);

  const renderSessionRow = (session) => {
    const checked = selected.has(session.id);
    const isArchived = Boolean(session.archived);
    return React.createElement(
      'div',
      { key: session.id, className: cx('ss-row', checked && 'selected') },
      React.createElement('input', {
        type: 'checkbox',
        className: 'ss-check',
        checked,
        onChange: () => toggleSelect(session.id),
        'aria-label': session.title,
      }),
      React.createElement(
        'div',
        { className: 'ss-rowmain' },
        React.createElement(
          Tip,
          {
            text: [
              `${t('sessionTitleLabel')}${session.title || session.id}`,
              session.workspacePath ? `${t('sessionPathLabel')}${session.workspacePath}` : null,
              `${t('sessionActionLabel')}${t('openSessionHint')}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ss-rowtitle',
              onClick: () => openSessionSafe(session.id),
            },
            session.title || session.id,
          ),
        ),
        React.createElement(
          'div',
          { className: 'ss-rowmeta' },
          React.createElement(
            Tip,
            { text: fmtDate(session.updatedAt) },
            React.createElement('span', null, fmtWhen(session.updatedAt)),
          ),
          React.createElement('span', null, t('messagesN').replace('{n}', String(session.messageCount ?? 0))),
          React.createElement('span', null, fmtBytes(session.sizeBytes)),
          session.running ? React.createElement('span', { className: 'ss-badge running' }, t('running')) : null,
          isArchived ? React.createElement('span', { className: 'ss-badge archived' }, t('archived')) : null,
          session.blank ? React.createElement('span', { className: 'ss-badge blank' }, t('blank')) : null,
        ),
      ),
      React.createElement(
        'div',
        { className: 'ss-rowactions' },
        React.createElement(
          Tip,
          { text: t('openSessionHint') },
          React.createElement(
            'button',
            { type: 'button', className: 'ss-iconbtn', onClick: () => openSessionSafe(session.id) },
            t('open'),
          ),
        ),
        isArchived
          ? React.createElement(
              Tip,
              { text: t('unarchiveSessionHint') },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'ss-iconbtn',
                  disabled: busy,
                  onClick: () => run(async () => {
                    await bridge.api('unarchiveSessions', { sessionIds: [session.id] });
                    return t('restoredMsg').replace('{n}', '1');
                  }),
                },
                t('unarchive'),
              ),
            )
          : React.createElement(
              Tip,
              { text: t('archiveSessionHint') },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'ss-iconbtn',
                  disabled: busy,
                  onClick: () => archiveSessions([session.id]),
                },
                t('archive'),
              ),
            ),
        React.createElement(
          Tip,
          { text: session.running ? t('runningHint') : t('trashSessionHint') },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ss-iconbtn',
              disabled: busy || session.running,
              onClick: () => trashSessions([session.id]),
            },
            t('moveToTrash'),
          ),
        ),
        React.createElement(
          Tip,
          { text: t('exportSessionHint') },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ss-iconbtn',
              disabled: busy,
              onClick: () => openExport(session),
            },
            t('exportAction'),
          ),
        ),
      ),
    );
  };

  const renderSessionsTab = () =>
    React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { className: 'ss-toolbar' },
        React.createElement('input', {
          className: 'ss-input',
          type: 'search',
          placeholder: t('searchPlaceholder'),
          value: query,
          onChange: (event) => setQuery(event.target.value),
        }),
        React.createElement(
          'div',
          {
            className: 'ss-menuwrap',
            onKeyDown: (event) => {
              if (event.key === 'Escape') setSortOpen(false);
            },
          },
          React.createElement(
            Tip,
            { text: t('sortLabel') },
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'ss-menu-btn',
                'aria-haspopup': 'menu',
                'aria-expanded': sortOpen ? 'true' : 'false',
                onClick: () => setSortOpen((open) => !open),
              },
              t((SORT_OPTIONS.find((option) => option.id === sort) || SORT_OPTIONS[0]).key),
              React.createElement(ChevronDownIcon, { size: 14, className: 'ss-menu-chevron' }),
            ),
          ),
          sortOpen
            ? React.createElement('div', { className: 'ss-menu-backdrop', onMouseDown: () => setSortOpen(false) })
            : null,
          sortOpen
            ? React.createElement(
                'div',
                { className: 'ss-menu', role: 'menu' },
                SORT_OPTIONS.map((option) =>
                  React.createElement(
                    'button',
                    {
                      key: option.id,
                      type: 'button',
                      role: 'menuitemradio',
                      'aria-checked': sort === option.id ? 'true' : 'false',
                      className: 'ss-menu-item',
                      onClick: () => {
                        setSort(option.id);
                        setSortOpen(false);
                      },
                    },
                    t(option.key),
                    sort === option.id
                      ? React.createElement(MenuCheckIcon, { size: 14, className: 'ss-menu-check' })
                      : null,
                  ),
                ),
              )
            : null,
        ),
        React.createElement('button', { type: 'button', className: 'ss-btn quiet', disabled: busy, onClick: refresh }, t('refresh')),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'ss-btn',
            disabled: busy || blankSessions.length === 0,
            title: blankSessions.length === 0 ? t('autoCleanEmpty') : undefined,
            onClick: askCleanBlank,
          },
          t('autoClean'),
        ),
      ),
      React.createElement(
        'div',
        { className: 'ss-scopefilter', role: 'group', 'aria-label': t('sessionFilterLabel') },
        [
          ['all', t('scopeAll')],
          ['running', t('running')],
          ['archived', t('archived')],
          ['blank', t('blank')],
        ].map(([id, label]) =>
          React.createElement(
            'button',
            {
              key: id,
              type: 'button',
              className: cx('ss-chip', sessionStatusFilter === id && 'active'),
              'aria-pressed': sessionStatusFilter === id ? 'true' : 'false',
              onClick: () => setSessionStatusFilter((current) => (current === id ? 'all' : id)),
            },
            label,
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'ss-sessionssummary ss-kpis' },
        selected.size > 0
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement('b', null, t('selectedN').replace('{n}', String(selected.size))),
              React.createElement(
                Tip,
                { text: t('archiveSessionHint') },
                React.createElement('button', { type: 'button', className: 'ss-btn tiny', disabled: busy, onClick: () => archiveSessions([...selected]) }, t('archive')),
              ),
              React.createElement(
                Tip,
                { text: t('trashSessionHint') },
                React.createElement('button', { type: 'button', className: 'ss-btn tiny', disabled: busy, onClick: () => trashSessions([...selected]) }, t('moveToTrash')),
              ),
            )
          : React.createElement(
              React.Fragment,
              null,
              React.createElement('span', null, React.createElement('b', null, String(sessions.length)), ' ', t('tabSessions')),
              React.createElement('span', null, fmtBytes(totalSize)),
              blankSessions.length > 0
                ? React.createElement('span', null, t('blank') + ' ' + String(blankSessions.length))
                : null,
            ),
      ),
      React.createElement(
        'div',
        { className: 'ss-card ss-sessioncard' },
      groups.length === 0
        ? React.createElement('div', { className: 'ss-empty' }, sessions.length === 0 ? t('noSessions') : t('noVisibleSessions'))
        : groups.map((group) =>
            React.createElement(
              'div',
              { key: group.id, className: 'ss-group' },
              React.createElement(
                'div',
                { className: 'ss-grouphead' },
                React.createElement(
                  Tip,
                  { text: collapsedGroups.has(groupKeyOf(group)) ? t('expandGroup') : t('collapseGroup') },
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'ss-groupcollapse',
                      'aria-expanded': collapsedGroups.has(groupKeyOf(group)) ? 'false' : 'true',
                      onClick: () => toggleGroupCollapsed(groupKeyOf(group)),
                    },
                    React.createElement(ChevronDownIcon, {
                      size: 14,
                      className: cx('ss-groupcollapse-icon', collapsedGroups.has(groupKeyOf(group)) && 'collapsed'),
                    }),
                  ),
                ),
                React.createElement('b', null, workspaceDisplayName(group)),
                React.createElement('span', null, t('workspaceGroup').replace('{n}', String(group.sessions.length))),
                group.path
                  ? React.createElement(
                      'button',
                      { type: 'button', className: 'ss-chip', onClick: () => openWorkspacePath(group.path) },
                      t('openPath'),
                    )
                  : null,
                group.path
                  ? React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'ss-chip',
                        onClick: () => toggleGroupPath(groupKeyOf(group)),
                      },
                      visiblePaths.has(groupKeyOf(group)) ? t('hidePath') : t('showPath'),
                    )
                  : null,
                group.path && visiblePaths.has(groupKeyOf(group))
                  ? React.createElement('span', { className: 'ss-wspath' }, group.path)
                  : null,
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'ss-chip',
                    style: { marginLeft: 'auto' },
                    onClick: () =>
                      groupAllSelected(group)
                        ? unselectMany(group.sessions.map((session) => session.id))
                        : selectMany(group.sessions.map((session) => session.id)),
                  },
                  t(groupAllSelected(group) ? 'clearAll' : 'selectAll'),
                ),
              ),
              (() => {
                const groupKey = groupKeyOf(group);
                const collapsed = collapsedGroups.has(groupKey);
                if (collapsed && !closingGroups.has(groupKey)) return null;
                return React.createElement(
                  'div',
                  {
                    className: 'ss-groupanim',
                    ref: (node) => {
                      if (!node) {
                        groupNodeRefs.current.delete(groupKey);
                        return;
                      }
                      groupNodeRefs.current.set(groupKey, node);
                      if (openingGroupsRef.current.has(groupKey)) {
                        openingGroupsRef.current.delete(groupKey);
                        node.style.height = '0px';
                        void node.offsetHeight;
                        node.style.height = `${node.scrollHeight}px`;
                        groupTimersRef.current.set(groupKey, setTimeout(() => {
                          groupTimersRef.current.delete(groupKey);
                          if (groupNodeRefs.current.get(groupKey) === node && node.style) node.style.height = '';
                        }, GROUP_ANIM_MS + 400));
                      }
                    },
                    onTransitionEnd: (event) => {
                      if (!event || event.target !== event.currentTarget || event.propertyName !== 'height') return;
                      if (closingGroups.has(groupKey)) finishGroupClose(groupKey);
                      else if (event.currentTarget.style) event.currentTarget.style.height = '';
                    },
                  },
                  group.sessions.map(renderSessionRow),
                );
              })(),
            ),
          ),
        ),
    );

  const renderTrashTab = () =>
    React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { className: 'ss-toolbar' },
        React.createElement('span', { className: 'ss-kpis' }, React.createElement('b', null, String(trash.length)), ' ', t('tabTrash'), ' · ', fmtBytes(trashSize)),
        trash.length > 0
          ? React.createElement(
              'button',
              {
                type: 'button',
                className: 'ss-chip',
                onClick: () => {
                  const allSelected = trash.every((entry) => selected.has(entry.sessionId));
                  const next = new Set(selected);
                  trash.forEach((entry) => {
                    if (allSelected) next.delete(entry.sessionId);
                    else next.add(entry.sessionId);
                  });
                  setSelected(next);
                },
              },
              trash.every((entry) => selected.has(entry.sessionId)) ? t('clearAll') : t('selectAll'),
            )
          : null,
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'ss-btn danger',
            disabled: busy || trash.length === 0,
            onClick: emptyTrash,
            style: { marginLeft: 'auto' },
          },
          t('emptyTrash'),
        ),
      ),
      React.createElement('div', { className: 'ss-hint', style: { marginBottom: 12 } }, t('trashHint')),
      trash.length === 0
        ? React.createElement(
            'div',
            { className: 'ss-empty ss-empty-illustrated' },
            React.createElement(TrashEmptyIcon, { size: 40 }),
            React.createElement('div', null, t('noTrash')),
          )
        : trash.map((entry) =>
            React.createElement(
              'div',
              { key: entry.sessionId, className: cx('ss-row', selected.has(entry.sessionId) && 'selected') },
              React.createElement('input', {
                type: 'checkbox',
                className: 'ss-check',
                checked: selected.has(entry.sessionId),
                onChange: () => toggleSelect(entry.sessionId),
                'aria-label': entry.title,
              }),
              React.createElement(
                'div',
                { className: 'ss-rowmain' },
                React.createElement('span', { className: 'ss-rowtitle', title: entry.title }, entry.title),
                React.createElement(
                  'span',
                  { className: 'ss-rowmeta' },
                  React.createElement('span', null, entry.workspaceTitle || t('unknownWorkspace')),
                  React.createElement('span', { title: fmtDate(entry.deletedAt) }, t('deletedAt').replace('{time}', fmtWhen(entry.deletedAt))),
                  React.createElement('span', null, fmtBytes(entry.sizeBytes)),
                  entry.wasArchived ? React.createElement('span', { className: 'ss-badge archived' }, t('archived')) : null,
                ),
              ),
              React.createElement(
                'div',
                { className: 'ss-rowactions' },
                React.createElement('button', { type: 'button', className: 'ss-iconbtn', disabled: busy, onClick: () => restoreFromTrash([entry.sessionId]) }, t('restore')),
                React.createElement('button', { type: 'button', className: 'ss-iconbtn danger', disabled: busy, onClick: () => purgeFromTrash([entry.sessionId]) }, t('purge')),
              ),
            ),
          ),
      selected.size > 0 && trash.length > 0
        ? React.createElement(
            'div',
            { className: 'ss-card ss-selectbar', style: { marginTop: 14 } },
            React.createElement(
              'div',
              { className: 'ss-toolbar', style: { marginBottom: 0 } },
              React.createElement('span', { className: 'ss-kpis' }, t('selectedN').replace('{n}', String(selected.size))),
              React.createElement('button', { type: 'button', className: 'ss-btn', disabled: busy, onClick: () => restoreFromTrash([...selected].filter((id) => trash.some((entry) => entry.sessionId === id))) }, t('restore')),
              React.createElement('button', { type: 'button', className: 'ss-btn danger', disabled: busy, onClick: () => purgeFromTrash([...selected].filter((id) => trash.some((entry) => entry.sessionId === id))) }, t('purge')),
              React.createElement('button', { type: 'button', className: 'ss-btn ghost', onClick: () => setSelected(new Set()) }, t('clearSelection')),
            ),
          )
        : null,
    );

  const normalizeName = (value) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const localeId = bridge.getLocaleId();

  const localizeText = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return '';
    const candidates = [localeId, String(localeId || '').split('-')[0], 'en'];
    for (const key of candidates) {
      if (key && typeof value[key] === 'string') return value[key];
    }
    const first = Object.values(value).find((entry) => typeof entry === 'string');
    return typeof first === 'string' ? first : '';
  };

  const inventoryItems = Array.isArray(inventory?.items) ? inventory.items : [];
  const inventoryByKey = new Map();
  for (const item of inventoryItems) {
    const key = item?.key || normalizeName(item?.moduleName);
    if (key && !inventoryByKey.has(key)) inventoryByKey.set(key, item);
  }

  const findInventory = (panel) => {
    const registrant = normalizeName(panel.registrant);
    if (!registrant) return null;
    if (inventoryByKey.has(registrant)) return inventoryByKey.get(registrant);
    for (const [key, item] of inventoryByKey) {
      if (key && (key.includes(registrant) || registrant.includes(key))) return item;
    }
    return null;
  };

  /* ---- composition plane (global host loader vs Agent preset session) ---- */

  const scopesOf = (item) => {
    const scopes = item && Array.isArray(item.scopes) ? item.scopes : [];
    return scopes.length > 0 ? scopes : ['global'];
  };

  const isSessionOnly = (item) => {
    const scopes = scopesOf(item);
    return scopes.indexOf('session') !== -1 && scopes.indexOf('global') === -1;
  };

  const scopeTag = (item) => {
    const scopes = scopesOf(item);
    if (scopes.indexOf('global') !== -1 && scopes.indexOf('session') !== -1) {
      return { key: 'scopeBoth', tone: 'scope-both', title: t('scopeBothHint') };
    }
    if (scopes.indexOf('session') !== -1) {
      return { key: 'scopeSession', tone: 'scope-session', title: t('scopeSessionHint') };
    }
    return { key: 'scopeGlobal', tone: 'scope-global', title: t('scopeGlobalHint') };
  };

  const scopeMatches = (item) => {
    if (scopeFilter === 'all') return true;
    const scopes = scopesOf(item);
    return scopeFilter === 'global' ? scopes.indexOf('global') !== -1 : scopes.indexOf('session') !== -1;
  };

  // The inventory row is the source of truth for "enabled"; rows that are not
  // part of the inventory (the built-in Plugins entry) count as enabled.
  const statusMatches = (item) => {
    if (statusFilter === 'all') return true;
    const enabled = item ? item.enabled !== false : true;
    return statusFilter === 'enabled' ? enabled : !enabled;
  };

  const scopeDetail = (item) => {
    const scopes = scopesOf(item);
    if (scopes.indexOf('global') !== -1 && scopes.indexOf('session') !== -1) return t('scopeAll');
    return scopes.indexOf('session') !== -1 ? t('scopeSession') : t('scopeGlobal');
  };

  const presetsDetail = (item) => {
    const presets = item && Array.isArray(item.presets) ? item.presets : [];
    if (presets.length === 0) return '—';
    return presets
      .map((preset) => {
        let text = preset.name || preset.id || '';
        if (preset.default === true) text += '（' + t('scopeDefaultPreset') + '）';
        if (preset.enabled === 'conditional') text += '（' + t('scopeConditional') + '）';
        return text;
      })
      .join('、');
  };

  const shortSource = (source) => {
    if (!source) return '';
    if (/^link:|^file:|^\.\.?[\\/]|^[a-z]:[\\/]/i.test(source)) return t('panelLocal');
    if (/^git|^https?:.*\.git$/i.test(source)) return 'Git';
    return source;
  };

  const panelOrigin = (item) => {
    if (!item) return t('panelBuiltin');
    if (item.official === true) return t('panelOfficial');
    if (item.source && /^link:|^file:|^\.\.?[\\/]|^[a-z]:[\\/]/i.test(item.source)) return t('panelLocal');
    return t('panelThirdParty');
  };

  const panelStatus = (item) => {
    if (!item) return null;
    if (item.fiberPhase === 'failed') return { key: 'panelStateFailed', tone: 'error' };
    if (item.enabled !== true) return { key: 'panelStateDisabled', tone: 'muted' };
    if (item.readOnlyReason) return { key: 'panelStateReadOnly', tone: 'info' };
    return { key: 'panelStateActive', tone: 'ok' };
  };

  const panelPhaseText = (item) => {
    if (!item) return t('panelPhaseBuiltin');
    const phase = item && item.fiberPhase;
    if (!phase) {
      if (item && item.enabled === false) return t('panelPhaseNotLoaded');
      return '—';
    }
    if (phase === 'pending') return t('panelPhasePending');
    if (phase === 'loading') return t('panelPhaseLoading');
    if (phase === 'active') return t('panelPhaseActive');
    if (phase === 'failed') return t('panelPhaseFailed');
    if (phase === 'unloading') return t('panelPhaseUnloading');
    return String(phase);
  };

  const panelPhaseNode = (item) => {
    const phase = item && item.fiberPhase;
    const known = ['pending', 'loading', 'active', 'failed', 'unloading'];
    const tone = !item
      ? 'builtin'
      : phase
        ? (known.includes(phase) ? phase : 'unknown')
        : item.enabled === false
          ? 'notloaded'
          : 'unknown';
    return React.createElement('span', { className: `ss-phase ss-phase-${tone}` }, panelPhaseText(item));
  };

  const panelReadOnlyText = (item) => {
    const reason = item && item.readOnlyReason;
    if (!reason) return '—';
    if (reason === 'management-required') return t('panelStateReadOnly');
    if (reason === 'unaddressable') return t('panelStateUnaddressable');
    return String(reason);
  };

  const DETAIL_ANIM_MS = 280;
  const clearDetailTimer = (id) => {
    const timer = detailTimersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      detailTimersRef.current.delete(id);
    }
  };
  const finishDetailClose = (id) => {
    clearDetailTimer(id);
    // Drop the node reference only. The inline height is intentionally left at
    // `0px` until React unmounts the block: clearing it first would expand the
    // detail back to its full height for one layout pass, which made the rows
    // below visibly flash.
    detailNodeRefs.current.delete(id);
    // Expand state goes first: if these two updates ever land in separate
    // renders, the row must not render its `open` class again (that would
    // replay the expand animation on a zero-height block).
    setExpandedPanels((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setClosingDetails((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  };
  const expandDetail = (id) => {
    clearDetailTimer(id);
    setClosingDetails((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setExpandedPanels((previous) => {
      if (previous.has(id)) return previous;
      return new Set(previous).add(id);
    });
    const node = detailNodeRefs.current.get(id);
    if (node && node.style && node.style.height) {
      node.style.height = '0px';
      void node.offsetHeight;
      node.style.height = `${node.scrollHeight}px`;
      detailTimersRef.current.set(id, setTimeout(() => {
        detailTimersRef.current.delete(id);
        if (node.style) node.style.height = '';
      }, DETAIL_ANIM_MS + 400));
    }
  };
  const collapseDetail = (id) => {
    clearDetailTimer(id);
    const node = detailNodeRefs.current.get(id);
    if (node && node.style && typeof node.getBoundingClientRect === 'function') {
      // Pin the rendered height first: transitioning out of `auto` never
      // animates, so the measured pixel height is the only reliable start
      // value for a CSS height transition. Do this before the state update so
      // the measured value is never taken while the `open` class is changing.
      node.style.height = `${node.getBoundingClientRect().height}px`;
      void node.offsetHeight;
      node.style.height = '0px';
    }
    setClosingDetails((previous) => {
      if (previous.has(id)) return previous;
      return new Set(previous).add(id);
    });
    const timer = setTimeout(() => finishDetailClose(id), node ? DETAIL_ANIM_MS + 900 : DETAIL_ANIM_MS);
    detailTimersRef.current.set(id, timer);
  };
  const togglePanelDetails = (id) => {
    if (closingDetails.has(id)) {
      expandDetail(id);
      return;
    }
    if (expandedPanels.has(id)) collapseDetail(id);
    else expandDetail(id);
  };
  const renderDetailBlock = (id, factory) => {
    const open = expandedPanels.has(id);
    const closing = closingDetails.has(id);
    if (!open && !closing) return null;
    return React.createElement(
      'div',
      {
        // Keep the `open` class while collapsing: swapping it for `closing`
        // removed the finished expand animation in the same frame the inline
        // height starts moving, which made Chromium repaint the rows below.
        className: 'ss-detail-anim open',
        ref: (node) => {
          if (node) detailNodeRefs.current.set(id, node);
          else detailNodeRefs.current.delete(id);
        },
        onTransitionEnd: (event) => {
          if (!event || event.target !== event.currentTarget) return;
          if (event.propertyName !== 'height') return;
          if (closing) {
            finishDetailClose(id);
          } else if (event.currentTarget && event.currentTarget.style) {
            event.currentTarget.style.height = '';
          }
        },
      },
      safeDetails(factory),
    );
  };

  const safeDetails = (factory) => {
    try {
      return factory();
    } catch (error) {
      return React.createElement('div', { className: 'ss-detail' }, t('panelDetailsFailed'));
    }
  };

  const CJK_TEXT = /[\u3400-\u9fff\u3000-\u303f]/;

  const descriptionKeyOf = (item, fallback) =>
    `desc:${(item && (item.key || item.moduleName || item.entryId)) || fallback || ''}`;

  const translateDescription = async (key, text) => {
    setTranslations((previous) => ({
      ...previous,
      [key]: { status: 'loading', text: (previous[key] && previous[key].text) || '', showOriginal: false },
    }));
    try {
      const value = await bridge.api('translateText', { text });
      const translated = value && typeof value.text === 'string' ? value.text : '';
      setTranslations((previous) => ({
        ...previous,
        [key]: { status: translated ? 'done' : 'error', text: translated, showOriginal: false },
      }));
    } catch (error) {
      setTranslations((previous) => ({ ...previous, [key]: { status: 'error', text: '', showOriginal: false } }));
      const message = (error && error.message) || '';
      setToast({ text: /Unknown method|NOT_FOUND/i.test(message) ? t('translateRestart') : message || t('translateFailed') });
    }
  };

  const descriptionNode = (item, fallbackKey) => {
    const raw = localizeText(item && item.description);
    if (!raw) return React.createElement('div', { className: 'ss-detaildesc' }, t('panelNoDescription'));
    const english = !CJK_TEXT.test(raw);
    if (!english) return React.createElement('div', { className: 'ss-detaildesc' }, raw);
    const key = descriptionKeyOf(item, fallbackKey);
    const entry = translations[key];
    const translated = entry && entry.status === 'done' && entry.text ? entry.text : '';
    const loading = Boolean(entry && entry.status === 'loading');
    const failed = Boolean(entry && entry.status === 'error');
    const showOriginal = Boolean(entry && entry.showOriginal);
    const display = translated && !showOriginal ? translated : raw;
    const label = loading
      ? t('translating')
      : translated
        ? showOriginal
          ? t('showTranslatedDesc')
          : t('showOriginalDesc')
        : failed
          ? t('retryTranslate')
          : t('translateToZh');
    return React.createElement(
      'div',
      { className: 'ss-detaildescrow' },
      React.createElement('div', { className: 'ss-detaildesc' }, display),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'ss-btn tiny quiet',
          disabled: loading,
          onClick: () => {
            if (translated) {
              setTranslations((previous) => ({ ...previous, [key]: { ...previous[key], showOriginal: !showOriginal } }));
            } else {
              void translateDescription(key, raw);
            }
          },
        },
        label,
      ),
    );
  };

  const copiedTimer = React.useRef(null);

  const copyIdNode = (value) => {
    const id = value === undefined || value === null || value === '' ? '—' : String(value);
    const parts = [React.createElement('span', { key: 'text', className: 'ss-idtext' }, id)];
    if (id !== '—') {
      const copied = copiedId === id;
      parts.push(
        React.createElement(
          Tip,
          { key: 'copy', text: t('panelCopyId') },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ss-copyid',
              'aria-label': t('panelCopyId'),
              onClick: async (event) => {
                if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
                await bridge.copyText(id);
                setToast({ text: t('panelCopied') });
                setCopiedId(id);
                if (copiedTimer.current) clearTimeout(copiedTimer.current);
                copiedTimer.current = setTimeout(() => {
                  setCopiedId((current) => (current === id ? null : current));
                }, 1200);
              },
            },
            copied
              ? React.createElement(MenuCheckIcon, { size: 12 })
              : React.createElement(CopyIcon, { size: 13 }),
          ),
        ),
      );
    }
    return React.createElement('span', { className: 'ss-idline' }, parts);
  };

  const panelDetails = (panel, item) => {
    const rows = [
      [t('panelPkgFull'), (item && item.moduleName) || panel.registrant || '—'],
      [t('panelEntryId'), copyIdNode(panel.id)],
      [t('panelVersion'), (item && item.version) || '—'],
      [t('panelOrigin'), panelOrigin(item)],
      [t('panelSource'), (item && (shortSource(item.source) || item.bundle)) || '—'],
      [t('scopeTitle'), scopeDetail(item)],
      [t('scopePresets'), presetsDetail(item)],
      [t('panelLoadState'), panelPhaseNode(item)],
      [t('panelReadOnly'), panelReadOnlyText(item)],
      [t('panelRemovable'), removableDetail(item)],
    ];
    return React.createElement(
      'div',
      { className: 'ss-detail' },
      React.createElement(
        'div',
        { className: 'ss-detailgrid' },
        rows.map(([key, value]) =>
          React.createElement(
            'div',
            { key, className: 'ss-detailrow' },
            React.createElement('span', { className: 'ss-detailkey' }, key),
            React.createElement(
              'span',
              {
                className:
                  typeof value === 'string' || typeof value === 'number' ? 'ss-detailval' : 'ss-detailval ss-detailvalnode',
              },
              typeof value === 'string' || typeof value === 'number' ? String(value) : value,
            ),
          ),
        ),
      ),
      descriptionNode(item, panel.id),
      React.createElement(
        'div',
        { className: 'ss-detailactions' },
        React.createElement('button', { type: 'button', className: 'ss-btn quiet', onClick: () => bridge.openPanel(panel.id) }, t('panelOpen')),
      ),
    );
  };

  const pluginDisplayName = (item) => {
    if (!item) return '—';
    // Display strategy (user decision): chinese title, with the short technical
    // name in parentheses. Chinese names come from the host inventory; when the
    // host cannot resolve one we fall back to the technical name alone.
    const technical = item.shortName || localizeText(item.title) || item.moduleName || '';
    const zh = localizeText(item.titleZh);
    if (!zh) return technical || '—';
    if (!technical || zh === technical) return zh;
    return zh + '（' + technical + '）';
  };

  const pluginDetails = (item) => {
    const rows = [
      [t('panelPkgFull'), (item && item.moduleName) || '—'],
      [t('panelEntryId'), copyIdNode(item && item.entryId)],
      [t('panelVersion'), (item && item.version) || '—'],
      [t('panelOrigin'), panelOrigin(item)],
      [t('panelSource'), (item && (shortSource(item.source) || item.bundle)) || '—'],
      [t('scopeTitle'), scopeDetail(item)],
      [t('scopePresets'), presetsDetail(item)],
      [t('panelLoadState'), panelPhaseNode(item)],
      [t('panelReadOnly'), panelReadOnlyText(item)],
      [t('panelRemovable'), removableDetail(item)],
    ];
    return React.createElement(
      'div',
      { className: 'ss-detail' },
      React.createElement(
        'div',
        { className: 'ss-detailgrid' },
        rows.map(([key, value]) =>
          React.createElement(
            'div',
            { key, className: 'ss-detailrow' },
            React.createElement('span', { className: 'ss-detailkey' }, key),
            React.createElement(
              'span',
              {
                className:
                  typeof value === 'string' || typeof value === 'number' ? 'ss-detailval' : 'ss-detailval ss-detailvalnode',
              },
              typeof value === 'string' || typeof value === 'number' ? String(value) : value,
            ),
          ),
        ),
      ),
      descriptionNode(item, item && (item.key || item.moduleName)),
    );
  };

  const pluginTag = (item) => {
    if (!item) return { key: 'tagBuiltin', tone: 'off', title: t('builtinTagHint') };
    if (item.fiberPhase === 'failed') return { key: 'tagFailed', tone: 'failed', title: t('tagFailedHint') };
    if (item.enabled !== true) return { key: 'tagDisabled', tone: 'disabled', title: t('tagDisabledHint') };
    if (item.fiberPhase === 'active') return { key: 'tagEnabled', tone: 'on' };
    return { key: 'tagLoading', tone: 'loading', title: t('tagLoadingHint') };
  };

  const isSelfEntry = (item) => Boolean(
    item
    && typeof item.entryId === 'string'
    && (item.entryId.indexOf('dsh-keeper') !== -1 || item.entryId.indexOf(LEGACY_BUNDLE) !== -1),
  );

  const canTogglePlugin = (item) => Boolean(item && item.entryId && !item.readOnlyReason && !isSelfEntry(item));

  const canUninstallPlugin = (item) => Boolean(
    item && item.bundle && item.removable === true && item.bundle !== 'dsh-keeper' && item.bundle !== LEGACY_BUNDLE,
  );

  const uninstallReason = (item) => {
    if (!item) return t('uninstallLockedBuiltin');
    if (isSelfEntry(item) || item.bundle === 'dsh-keeper' || item.bundle === LEGACY_BUNDLE) return t('uninstallLockedSelf');
    if (!item.bundle) return t('uninstallLockedNoBundle');
    return t('uninstallLockedManaged');
  };

  /** 详情里的「是否可卸载」与列表行的「卸载/不可卸载」使用同一个判断，避免两处不一致。 */
  const removableDetail = (item) => {
    if (canUninstallPlugin(item)) return t('panelYes');
    const short = !item
      ? t('uninstallLockedBuiltinShort')
      : isSelfEntry(item) || item.bundle === 'dsh-keeper' || item.bundle === LEGACY_BUNDLE
        ? t('uninstallLockedSelfShort')
        : !item.bundle
          ? t('uninstallLockedNoBundleShort')
          : t('uninstallLockedManagedShort');
    return React.createElement('span', { key: 'removable', title: uninstallReason(item) }, `${t('panelNo')}（${short}）`);
  };

  const togglePluginEnabled = (item) => {
    if (!canTogglePlugin(item)) return;
    const nextEnabled = item.enabled !== true;
    void run(async () => {
      if (item.disabledByProfile === true) {
        await bridge.api('enablePluginOverride', { patchId: item.patchId || item.entryId });
        return t('actionRestart');
      }
      const result = await bridge.api('setPluginEnabled', { entryId: item.entryId, enabled: nextEnabled });
      if (result && result.application === 'restart-required') return t('actionRestart');
      return nextEnabled ? t('tagEnabled') : t('tagDisabled');
    });
  };

  const askUninstallPlugin = (item) => {
    if (!canUninstallPlugin(item)) return;
    const displayName = (item && (item.bundle || item.moduleName)) || '';
    setConfirm({
      title: t('uninstallConfirmTitle'),
      body: t('uninstallConfirmBody').replace('{name}', displayName),
      confirmLabel: t('uninstallConfirmAction'),
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await run(async () => {
          const result = await bridge.api('uninstallPlugin', { bundle: item.bundle, confirm: true });
          if (result && result.application === 'restart-required') return t('actionRestart');
          return t('uninstalledMsg').replace('{name}', displayName);
        });
      },
    });
  };

  const managementControls = (item) => {
    const scope = scopeTag(item);
    const nodes = [React.createElement('span', { key: 'scope', className: `ss-tag ${scope.tone}`, title: scope.title }, t(scope.key))];
    if (item && isSessionOnly(item)) {
      nodes.push(
        React.createElement(
          'span',
          { key: 'preset', className: 'ss-tag off', title: t('scopePresetManagedHint') },
          t('scopePresetManaged'),
        ),
      );
      return nodes;
    }
    const tag = pluginTag(item);
    nodes.push(React.createElement('span', { key: 'tag', className: `ss-tag ${tag.tone}`, title: tag.title }, t(tag.key)));
    if (item) {
      const toggleable = canTogglePlugin(item);
      nodes.push(
        React.createElement(
          'button',
          {
            key: 'toggle',
            type: 'button',
            className: 'ss-btn tiny',
            disabled: busy || !toggleable,
            title: isSelfEntry(item) ? t('selfPlugin') : item.readOnlyReason ? t('readonlyPlugin') : undefined,
            onClick: () => togglePluginEnabled(item),
          },
          item.enabled === true ? t('disablePlugin') : t('enablePlugin'),
        ),
      );
      if (canUninstallPlugin(item)) {
        nodes.push(
          React.createElement(
            'button',
            { key: 'uninstall', type: 'button', className: 'ss-btn tiny danger', disabled: busy, onClick: () => askUninstallPlugin(item) },
            t('uninstallPlugin'),
          ),
        );
      } else {
        nodes.push(React.createElement('span', { key: 'uninstall', className: 'ss-tag off', title: uninstallReason(item) }, t('cannotUninstall')));
      }
    } else {
      nodes.push(React.createElement('span', { key: 'uninstall', className: 'ss-tag off', title: uninstallReason(item) }, t('cannotUninstall')));
    }
    return nodes;
  };

  const renderPanelsTab = () => {
    const hiddenIds = hidden;
    const needle = panelQuery.trim().toLowerCase();
    const filtering = Boolean(needle) || scopeFilter !== 'all' || statusFilter !== 'all';
    // 默认收起；搜索/筛选时临时展开，方便直接看到命中的条目。
    const othersExpanded = othersOpen || filtering;
    const searchText = (...values) =>
      values
        .filter((value) => typeof value === 'string' && value)
        .join(' ')
        .toLowerCase();
    const panelMatches = (panel) => {
      if (!needle) return true;
      const item = findInventory(panel);
      return (
        searchText(
          panel.id,
          panel.registrant,
          panel.label,
          item && item.moduleName,
          item && item.entryId,
          item && item.bundle,
          item && item.key,
          item && item.version,
          item && item.shortName,
          item && localizeText(item.titleZh),
          item && localizeText(item.title),
          item && localizeText(item.description),
          item && item.title,
          item && item.description,
        ).indexOf(needle) !== -1
      );
    };
    const pluginMatches = (item) => {
      if (!needle) return true;
      return (
        searchText(
          item.moduleName,
          item.entryId,
          item.bundle,
          item.key,
          item.version,
          item.shortName,
          localizeText(item.titleZh),
          localizeText(item.title),
          localizeText(item.description),
          item.title,
          item.description,
        ).indexOf(needle) !== -1
      );
    };
    const visiblePanels = panels.filter((panel) => {
      const item = findInventory(panel);
      return panelMatches(panel) && scopeMatches(item) && statusMatches(item);
    });
    const matchedPluginKeys = new Set();
    const registerKey = (value) => {
      const key = normalizeName(value);
      if (key) matchedPluginKeys.add(key);
    };
    const panelMemory = panelMemoryRef.current;
    const livePanelKeys = new Set();
    const itemIdentities = (item) => {
      if (!item) return [];
      const values = [item.entryId, item.key, item.moduleName].map((value) => normalizeName(value));
      return values.filter((value, index) => value && values.indexOf(value) === index);
    };
    for (const panel of panels) {
      const item = findInventory(panel);
      if (!item) continue;
      const memory = {
        panelId: panel.id,
        label: panel.label || panel.id,
        component: panel.component,
      };
      for (const identity of itemIdentities(item)) {
        livePanelKeys.add(identity);
        panelMemory.set(identity, memory);
      }
      registerKey(item.key);
      registerKey(item.moduleName);
      registerKey(item.entryId);
    }
    if (bridge && typeof bridge.rememberPanels === 'function') {
      const plain = {};
      panelMemory.forEach((value, key) => {
        if (!value) return;
        plain[key] = { panelId: value.panelId, label: value.label };
      });
      const serialized = JSON.stringify(plain);
      if (serialized !== panelMemoryJsonRef.current) {
        panelMemoryJsonRef.current = serialized;
        bridge.rememberPanels(plain);
      }
    }
    const orphanPanels = [];
    const seenOrphans = new Set();
    for (const item of inventoryItems) {
      if (item.enabled !== false) continue;
      const identities = itemIdentities(item);
      if (identities.length === 0) continue;
      if (identities.some((identity) => livePanelKeys.has(identity) || seenOrphans.has(identity))) continue;
      const memory = identities.map((identity) => panelMemory.get(identity)).find(Boolean);
      if (!memory) continue;
      if (!pluginMatches(item) || !scopeMatches(item) || !statusMatches(item)) continue;
      for (const identity of identities) seenOrphans.add(identity);
      orphanPanels.push({ item, memory });
      registerKey(item.key);
      registerKey(item.moduleName);
      registerKey(item.entryId);
    }
    const seenOtherKeys = new Set();
    const otherPlugins = inventoryItems.filter((item) => {
      if (
        matchedPluginKeys.has(normalizeName(item.key)) ||
        matchedPluginKeys.has(normalizeName(item.moduleName)) ||
        matchedPluginKeys.has(normalizeName(item.entryId))
      ) {
        return false;
      }
      if (!Boolean(normalizeName(item.moduleName || item.entryId)) || !pluginMatches(item)) return false;
      if (!scopeMatches(item)) return false;
      if (!statusMatches(item)) return false;
      const identity = normalizeName(item.entryId || item.key || item.moduleName);
      if (!identity || seenOtherKeys.has(identity)) return false;
      seenOtherKeys.add(identity);
      return true;
    });
    const noMatches =
      filtering && visiblePanels.length === 0 && otherPlugins.length === 0 && orphanPanels.length === 0;
    const inventoryBroken = inventory && inventory.supported === false;
    const duplicates = new Map();
    for (const panel of panels) {
      const label = panel.label || panel.id;
      duplicates.set(label, (duplicates.get(label) ?? 0) + 1);
    }
    const conflicts = [...duplicates.entries()].filter(([, count]) => count > 1).map(([label]) => label);
    const togglePanel = (id) => {
      const next = new Set(hiddenIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveHidden(next);
    };
    const presetLean = () => {
      const next = new Set([MORE_PANEL_ID, MORE_ROW_BROWSE, MORE_ROW_CREATE]);
      for (const panel of panels) {
        if (panel.id !== PANEL_ID) next.add(panel.id);
      }
      saveHidden(next);
    };
    const presetAll = () => saveHidden(new Set());
    // Fixed sidebar items the host renders outside the panellist: the pinned
    // [plugins] entry and the More menu with its two shortcut rows. They are
    // hidden with injected CSS (the host exposes no visibility switch).
    const fixedRow = (id, label, meta, glyph, sub, tags, options) => {
      const override = options && typeof options === 'object' ? options : {};
      const tagNodes = (Array.isArray(tags) ? tags : []).map((tag, index) =>
        React.createElement(
          'span',
          {
            key: 'tag' + index,
            className: 'ss-tag scope-global',
            title: tag && tag.title ? tag.title : undefined,
          },
          tag && tag.text ? tag.text : '',
        ),
      );
      return React.createElement(
        'div',
        { key: id, className: 'ss-panelitem' },
        React.createElement(
          'div',
          { className: sub ? 'ss-panelrow ss-subrow' : 'ss-panelrow' },
          React.createElement('span', { className: 'ss-panelglyph' }, glyph),
          React.createElement(
            'div',
            { className: 'ss-panelmain', style: { cursor: 'default' } },
            React.createElement('span', { className: 'ss-panellabel' }, label),
            React.createElement('span', { className: 'ss-meta' }, meta),
          ),
          ...tagNodes,
          React.createElement(Switch, {
            checked:
              typeof override.checked === 'boolean' ? override.checked : !hiddenIds.has(id),
            label,
            title: override.title || t('panelEntryHint'),
            disabled: busy || override.disabled === true,
            onChange: () => togglePanel(id),
          }),
          React.createElement('span', { className: 'ss-expand-spacer', 'aria-hidden': 'true' }),
        ),
      );
    };
    const builtinTag = () => ({ text: t('tagBuiltin'), title: t('builtinTagHint') });
    // Option A: when every More shortcut is hidden and no other plugin
    // contributes rows to that menu, the launcher has nothing to show and is
    // hidden automatically. Turning any shortcut back on brings it back.
    const moreChildrenVisible =
      !hiddenIds.has(MORE_ROW_BROWSE) || !hiddenIds.has(MORE_ROW_CREATE);
    const foreignMoreRows =
      bridge && typeof bridge.hasForeignMoreRows === 'function'
        ? bridge.hasForeignMoreRows()
        : false;
    const moreAutoHidden =
      !hiddenIds.has(MORE_PANEL_ID) && !moreChildrenVisible && !foreignMoreRows;
    const fixedEntryRows = () => {
      const rows = [
        fixedRow(
          MORE_PANEL_ID,
          t('moreMenu'),
          t('moreMenuMeta'),
          React.createElement(MoreAppsIcon, { size: 15 }),
          false,
          [
            builtinTag(),
            moreAutoHidden
              ? { text: t('autoHiddenTag'), title: t('autoHiddenHint') }
              : { text: t('menuTag'), title: t('menuTagHint') },
          ],
          {
            checked: !hiddenIds.has(MORE_PANEL_ID) && !moreAutoHidden,
            disabled: moreAutoHidden,
            title: moreAutoHidden ? t('autoHiddenHint') : undefined,
          },
        ),
      ];
      if (!hiddenIds.has(MORE_PANEL_ID)) {
        // The two shortcut rows are children of the More menu: indent them and
        // connect them to the parent row with a tree guide.
        rows.push(
          React.createElement(
            'div',
            { className: 'ss-subtree', key: 'more-subtree' },
            fixedRow(
              MORE_ROW_BROWSE,
              t('moreBrowse'),
              t('moreRowsHint'),
              React.createElement(PinwheelIcon, { size: 14 }),
              true,
              [
                builtinTag(),
                { text: t('shortcutTag'), title: t('shortcutTagHint') },
              ],
            ),
            fixedRow(
              MORE_ROW_CREATE,
              t('moreCreate'),
              t('moreRowsHint'),
              React.createElement(PlusIcon, { size: 14 }),
              true,
              [
                builtinTag(),
                { text: t('shortcutTag'), title: t('shortcutTagHint') },
              ],
            ),
          ),
        );
      }
      return rows;
    };
    const otherRows = [];
    const usedOtherKeys = new Set();
    for (const item of otherPlugins) {
      const identity = item.entryId || item.key || item.moduleName || '';
      const baseKey = 'other:' + (identity || 'row' + otherRows.length);
      const stateKey = usedOtherKeys.has(baseKey) ? baseKey + '#' + otherRows.length : baseKey;
      usedOtherKeys.add(stateKey);
      otherRows.push({ item, stateKey });
    }
    // "Other installed plugins" intentionally share the official Plugins panel
    // icon from the sidebar (user decision): every default row glyph is the
    // shipped "插件" entry icon rather than our own fallback drawing.
    const officialPluginsGlyph = (() => {
      const entry = panels.find((panel) => panel.id === 'plugins');
      return entry && entry.component ? entry.component : null;
    })();
    // One switch for every detail block this page can render: sidebar panel
    // rows, remembered/disabled rows and the "other loaded plugins" rows.
    const detailKeys = [
      ...visiblePanels.map((panel) => panel.id),
      ...orphanPanels.map((item) => 'orphan:' + normalizeName(item.entryId || item.key || item.moduleName)),
      ...otherRows.map(({ stateKey }) => stateKey),
    ];
    // The control collapses first whenever anything is open, so a single
    // manually-closed row never flips the label back to "expand all". The
    // "other loaded plugins" section counts as open too, because its chevron
    // reveals rows that the same control governs.
    const otherSectionOpen = othersOpen && otherRows.length > 0;
    const anyDetailsExpanded = otherSectionOpen || detailKeys.some((key) => expandedPanels.has(key));
    const toggleAllDetails = () => {
      const opening = !anyDetailsExpanded;
      // The "other loaded plugins" section is collapsed by default; the
      // expand-all control drives that section's own state too so every
      // expandable row on the page follows the same command.
      if (opening) {
        detailTimersRef.current.forEach((timer) => clearTimeout(timer));
        detailTimersRef.current.clear();
        detailNodeRefs.current.forEach((node) => {
          if (node && node.style) node.style.height = '';
        });
        setClosingDetails(new Set());
        setOthersOpen(true);
        setExpandedPanels(new Set(detailKeys));
        return;
      }
      const openKeys = detailKeys.filter((key) => expandedPanels.has(key));
      // Only the already-open "other loaded plugins" section needs to stay
      // mounted while its rows animate shut. If it was collapsed, leaving it
      // collapsed avoids the visible open-then-close flicker on that chevron.
      const keepOthersOpen = othersExpanded;
      if (keepOthersOpen) setOthersOpen(true);
      openKeys.forEach((key) => collapseDetail(key));
      clearDetailTimer('__all__');
      if (!keepOthersOpen) return;
      const timer = setTimeout(() => {
        detailTimersRef.current.delete('__all__');
        setOthersOpen(false);
      }, DETAIL_ANIM_MS + 20);
      detailTimersRef.current.set('__all__', timer);
    };
    return React.createElement(
      'div',
      { className: 'ss-panels' },
      React.createElement(
        'div',
        { className: 'ss-panelshead' },
        React.createElement('div', { className: 'ss-hint', style: { marginBottom: 12 } }, t('panelsHint')),
      conflicts.length > 0
        ? React.createElement(
            'div',
            { className: 'ss-banner' },
            React.createElement('span', null, `${t('conflictTitle')}：${t('conflictBody').replace('{names}', conflicts.join('、'))}`),
          )
        : null,
      inventoryBroken
        ? React.createElement(
            'div',
            { className: 'ss-banner' },
            React.createElement('span', null, t('panelInventoryRestart')),
          )
        : inventory && inventory.warning
          ? React.createElement(
              'div',
              { className: 'ss-banner' },
              React.createElement('span', null, `${t('panelInventoryUnavailable')} ${String(inventory.warning)}`),
            )
          : null,
      React.createElement(
        'div',
        { className: 'ss-toolbar' },
        React.createElement('button', { type: 'button', className: 'ss-btn', disabled: busy, onClick: presetLean }, t('presetLean')),
        React.createElement('button', { type: 'button', className: 'ss-btn', disabled: busy, onClick: presetAll }, t('presetAll')),
        React.createElement('button', { type: 'button', className: 'ss-btn ghost', disabled: busy, onClick: () => saveHidden(new Set()) }, t('resetPanels')),
        hiddenIds.has(PLUGINS_PANEL_ID)
          ? React.createElement(
              'button',
              { type: 'button', className: 'ss-chip', onClick: () => bridge.openPanel(PLUGINS_PANEL_ID) },
              t('openPluginsPanel'),
            )
          : null,
      ),
      React.createElement(
        'div',
        { className: 'ss-searchrow' },
        React.createElement('input', {
          className: 'ss-input',
          type: 'search',
          value: panelQuery,
          placeholder: t('panelsSearchPlaceholder'),
          'aria-label': t('panelsSearchPlaceholder'),
          onChange: (event) => setPanelQuery(event.target.value),
        }),
      ),
      React.createElement(
        'div',
        { className: 'ss-filterbar' },
        React.createElement(
        'div',
        { className: 'ss-scopefilter', role: 'group', 'aria-label': t('scopeFilterLabel') },
        [
          ['all', 'scopeAll'],
          ['global', 'scopeGlobal'],
          ['session', 'scopeSession'],
        ].map(([id, key]) =>
          React.createElement(
            'button',
            {
              key: id,
              type: 'button',
              className: scopeFilter === id ? 'ss-chip active' : 'ss-chip',
              'aria-pressed': scopeFilter === id ? 'true' : 'false',
              onClick: () => setScopeFilter(id),
            },
            t(key),
          ),
        ),
        React.createElement('span', { className: 'ss-filterdivider', 'aria-hidden': 'true' }),
        [
          ['enabled', 'statusEnabled'],
          ['disabled', 'statusDisabled'],
        ].map(([id, key]) =>
          React.createElement(
            'button',
            {
              key: id,
              type: 'button',
              className: statusFilter === id ? 'ss-chip active' : 'ss-chip',
              'aria-pressed': statusFilter === id ? 'true' : 'false',
              onClick: () => setStatusFilter((current) => (current === id ? 'all' : id)),
            },
            t(key),
          ),
        ),
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'ss-chip ss-expandall',
            disabled: detailKeys.length === 0,
            'aria-pressed': anyDetailsExpanded ? 'true' : 'false',
            onClick: toggleAllDetails,
          },
          t(anyDetailsExpanded ? 'collapseAllDetails' : 'expandAllDetails'),
        ),
      ),
      ),
      React.createElement(
        'div',
        { className: 'ss-panelslist', ref: panelsListRef, onScroll: handleRootScroll },
        React.createElement(
        'div',
        { className: cx('ss-card ss-plugincard', !othersExpanded && otherPlugins.length > 0 && 'ss-plugincard-collapsed') },
        !filtering || visiblePanels.length + orphanPanels.length > 0
          ? React.createElement('div', { className: 'ss-band' })
          : null,
        !filtering || visiblePanels.length + orphanPanels.length > 0
          ? React.createElement(
              'div',
              { className: 'ss-sectiontitle' },
              t('enabledPanelsTitle') + '（' + (visiblePanels.length + orphanPanels.length) + '）',
            )
          : null,
        panels.length === 0 && orphanPanels.length === 0
          ? React.createElement('div', { className: 'ss-empty' }, t('loading'))
          : visiblePanels.length === 0 && orphanPanels.length === 0
            ? noMatches
              ? React.createElement('div', { className: 'ss-empty' }, t('panelsSearchEmpty'))
              : filtering
                ? null
                : React.createElement('div', { className: 'ss-empty' }, t('loading'))
            : visiblePanels.map((panel) => {
              const item = findInventory(panel);
              const meta = [];
              if (item && item.version) meta.push('v' + item.version);
              meta.push(panelOrigin(item));
              const expanded = expandedPanels.has(panel.id);
              const row = React.createElement(
                'div',
                { className: 'ss-panelrow' },
                React.createElement('span', { className: 'ss-panelglyph' }, React.createElement(PanelGlyph, { component: panel.component, size: 15 })),
                React.createElement(
                  Tip,
                  { text: expanded ? t('panelCollapse') : t('panelExpand'), followPointer: true },
                  React.createElement(
                    'div',
                    {
                      className: 'ss-panelmain',
                      role: 'button',
                      tabIndex: 0,
                      onClick: () => togglePanelDetails(panel.id),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          togglePanelDetails(panel.id);
                        }
                      },
                    },
                    React.createElement('span', { className: 'ss-panellabel' }, panel.label || panel.id),
                    React.createElement('span', { className: 'ss-meta' }, meta.join(' · ')),
                  ),
                ),
                ...managementControls(item),
                React.createElement(Switch, {
                  checked: !hiddenIds.has(panel.id),
                  label: panel.label || panel.id,
                  title: t('panelEntryHint'),
                  disabled: busy,
                  onChange: () => togglePanel(panel.id),
                }),
                React.createElement(
                  Tip,
                  { text: expanded ? t('panelCollapse') : t('panelExpand') },
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'ss-expand',
                      'aria-expanded': expanded ? 'true' : 'false',
                      onClick: (event) => {
                        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
                        togglePanelDetails(panel.id);
                      },
                    },
                    React.createElement(ChevronDownIcon, { className: expanded ? 'ss-expand-icon open' : 'ss-expand-icon' }),
                  ),
                ),
              );
              return React.createElement(
                'div',
                { key: panel.id, className: 'ss-panelitem' },
                row,
                renderDetailBlock(panel.id, () => panelDetails(panel, item)),
              );
            }),
        orphanPanels.map(({ item, memory }) => {
          const rowKey = 'orphan:' + normalizeName(item.entryId || item.key || item.moduleName);
          const expanded = expandedPanels.has(rowKey);
          const meta = [];
          if (item.version) meta.push('v' + item.version);
          meta.push(panelOrigin(item));
          const row = React.createElement(
            'div',
            { className: 'ss-panelrow' },
            React.createElement(
              'span',
              { className: 'ss-panelglyph' },
              React.createElement(PanelGlyph, { component: memory.component, size: 15 }),
            ),
            React.createElement(
              Tip,
              { text: expanded ? t('panelCollapse') : t('panelExpand'), followPointer: true },
              React.createElement(
                'div',
                {
                  className: 'ss-panelmain',
                  role: 'button',
                  tabIndex: 0,
                  onClick: () => togglePanelDetails(rowKey),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      togglePanelDetails(rowKey);
                    }
                  },
                },
                React.createElement('span', { className: 'ss-panellabel' }, memory.label || pluginDisplayName(item)),
                React.createElement('span', { className: 'ss-meta' }, meta.join(' · ')),
              ),
            ),
            ...managementControls(item),
            React.createElement(
              Tip,
              { text: expanded ? t('panelCollapse') : t('panelExpand') },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'ss-expand',
                  'aria-expanded': expanded ? 'true' : 'false',
                  onClick: (event) => {
                    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
                    togglePanelDetails(rowKey);
                  },
                },
                React.createElement(ChevronDownIcon, { className: expanded ? 'ss-expand-icon open' : 'ss-expand-icon' }),
              ),
            ),
          );
          return React.createElement(
            'div',
            { key: rowKey, className: 'ss-panelitem' },
            row,
            renderDetailBlock(rowKey, () => pluginDetails(item)),
          );
        }),
        !filtering ? fixedEntryRows() : null,
        otherPlugins.length > 0
          ? React.createElement(
              React.Fragment,
              { key: 'others' },
              !filtering || visiblePanels.length + orphanPanels.length > 0
                ? React.createElement('div', { className: 'ss-band' })
                : null,
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'ss-sectiontitle ss-sectiontoggle',
                  'aria-expanded': othersExpanded ? 'true' : 'false',
                  onClick: () => setOthersOpen((open) => !open),
                },
                React.createElement('span', null, t('othersTitle') + '（' + otherPlugins.length + '）'),
                React.createElement(ChevronDownIcon, { className: othersExpanded ? 'ss-expand-icon open' : 'ss-expand-icon' }),
              ),
              othersExpanded ? otherRows.map(({ item, stateKey }, index) => {
                const meta = [];
                if (item.version) meta.push('v' + item.version);
                meta.push(panelOrigin(item));
                const rowKey = stateKey;
                const expanded = expandedPanels.has(rowKey);
                const row = React.createElement(
                  'div',
                  { className: 'ss-panelrow' },
                  React.createElement('span', { className: 'ss-panelglyph' }, React.createElement(PanelGlyph, { component: officialPluginsGlyph, size: 15 })),
                  React.createElement(
                    Tip,
                    { text: expanded ? t('panelCollapse') : t('panelExpand'), followPointer: true },
                    React.createElement(
                      'div',
                      {
                        className: 'ss-panelmain',
                        role: 'button',
                        tabIndex: 0,
                        onClick: () => togglePanelDetails(rowKey),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            togglePanelDetails(rowKey);
                          }
                        },
                      },
                      React.createElement('span', { className: 'ss-panellabel' }, pluginDisplayName(item)),
                      React.createElement('span', { className: 'ss-meta' }, meta.join(' · ')),
                    ),
                  ),
                  ...managementControls(item),
                  React.createElement(
                    Tip,
                    { text: expanded ? t('panelCollapse') : t('panelExpand') },
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'ss-expand',
                        'aria-expanded': expanded ? 'true' : 'false',
                        onClick: (event) => {
                          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
                          togglePanelDetails(rowKey);
                        },
                      },
                      React.createElement(ChevronDownIcon, { className: expanded ? 'ss-expand-icon open' : 'ss-expand-icon' }),
                    ),
                  ),
                );
                return React.createElement(
                  'div',
                  { key: rowKey, className: 'ss-panelitem' },
                  row,
                  renderDetailBlock(rowKey, () => pluginDetails(item)),
                );
              }) : null,
            )
          : null,
        ),
      ),
    );
  };

  const updateNotify = (patch) => {
    const current = normalizeNotifySettings(
      boot && boot.state && boot.state.settings ? boot.state.settings.notifications : null,
    );
    const next = normalizeNotifySettings({ ...current, ...patch });
    setBoot((previous) =>
      previous
        ? {
            ...previous,
            state: {
              ...previous.state,
              settings: { ...((previous.state && previous.state.settings) || {}), notifications: next },
            },
          }
        : previous,
    );
    if (notifySaveTimerRef.current) clearTimeout(notifySaveTimerRef.current);
    notifySaveTimerRef.current = setTimeout(() => {
      notifySaveTimerRef.current = null;
      bridge.api('saveSettings', { settings: { notifications: next } }).catch((error) => {
        setToast({ text: (t('notifySaveFailed') || 'save failed') + ': ' + (error && error.message ? error.message : String(error)) });
      });
    }, 220);
  };

  const resetNotify = async () => {
    const previous = normalizeNotifySettings(notifySettings);
    if (notifySaveTimerRef.current) {
      clearTimeout(notifySaveTimerRef.current);
      notifySaveTimerRef.current = null;
    }
    const defaults = normalizeNotifySettings(null);
    setBoot((previousBoot) =>
      previousBoot
        ? {
            ...previousBoot,
            state: {
              ...previousBoot.state,
              settings: { ...((previousBoot.state && previousBoot.state.settings) || {}), notifications: defaults },
            },
          }
        : previousBoot,
    );
    try {
      await bridge.api('saveSettings', { settings: { notifications: defaults } });
      setToast({ text: t('notifyResetDone'), undoValue: { kind: 'notify', settings: previous } });
    } catch (error) {
      setToast({ text: (t('notifySaveFailed') || 'save failed') + ': ' + (error && error.message ? error.message : String(error)) });
    }
  };

  const grantNotifications = async () => {
    setNotifyBusy(true);
    try {
      const permission = await requestNotificationPermission();
      setNotifyPermission(permission);
      if (permission === 'granted') setToast({ text: t('notifyPermissionGrantedToast') });
      else if (permission === 'denied') setToast({ text: t('notifyPermissionDeniedToast') });
    } finally {
      setNotifyBusy(false);
    }
  };

  const sendTestNotification = () => {
    const title = t('notifyTestTitle');
    const body = t('notifyTestBody');
    const delivered = showDesktopNotification(title, body, 'dsh-keeper-test', () => notifyOpenSession(''));
    if (!delivered) setToast({ text: title + '：' + body });
    // The test button is a preview: it always pops the notification and plays the
    // tone, even while every reminder channel is switched off.
    void playNotificationSound(bridge, 'done', { ...notifySettings, enabled: true, system: true, sound: 'system' });
  };

  const previewNotifySound = (kind) => {
    void playNotificationSound(bridge, kind === 'error' || kind === 'stopped' ? 'error' : 'done', notifySettings);
  };

  const pickNotifySound = (group) => {
    pendingSoundGroupRef.current = group;
    const input = notifyFileRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const uploadNotifySound = async (group, file) => {
    if (!file) return;
    if (typeof file.size === 'number' && file.size > 2 * 1024 * 1024) {
      setToast({ text: t('notifySoundTooLarge') });
      return;
    }
    setNotifyBusy(true);
    try {
      const data = await readFileAsBase64(file);
      const result = await bridge.api('saveNotificationSound', { kind: group, name: file.name, data });
      const nextSounds = {
        ...notifySettings.sounds,
        [group]: { name: result && result.name ? result.name : file.name },
      };
      await updateNotify({ sounds: nextSounds });
      setToast({ text: t('notifySoundSaved') });
      void playNotificationSound(bridge, group === 'interrupt' ? 'error' : 'done', {
        ...notifySettings,
        sounds: nextSounds,
      });
    } catch (error) {
      setToast({
        text: (t('notifySoundSaveFailed') || 'save failed') + ': ' + (error && error.message ? error.message : String(error)),
      });
    } finally {
      setNotifyBusy(false);
    }
  };

  const clearNotifySound = async (group) => {
    setNotifyBusy(true);
    try {
      await bridge.api('clearNotificationSound', { kind: group });
      const nextSounds = { ...notifySettings.sounds, [group]: { name: '' } };
      await updateNotify({ sounds: nextSounds });
      setToast({ text: t('notifySoundResetDone') });
    } catch (error) {
      setToast({
        text: (t('notifySoundSaveFailed') || 'save failed') + ': ' + (error && error.message ? error.message : String(error)),
      });
    } finally {
      setNotifyBusy(false);
    }
  };

  const renderNotifyTab = () => {
    const permission = notifyPermission;
    const permissionText =
      permission === 'granted'
        ? t('notifyPermissionGranted')
        : permission === 'denied'
          ? t('notifyPermissionDenied')
          : permission === 'unsupported'
            ? t('notifyPermissionUnsupported')
            : t('notifyPermissionDefault');
    const soundOn = notifySettings.sound !== 'none';
    // The 提醒事件 card is gone: task-state events are always reminded, so the
    // only remaining state is whether any channel (banner / sound) is on.
    // The footer reset applies to the whole page, so it is only actionable once
    // at least one option differs from the defaults.
    const notifyDefaults = notifySettingsAreDefault(notifySettings);
    const row = (label, hint, control, style) =>
      React.createElement(
        'div',
        { className: 'ss-field', style },
        React.createElement(
          'div',
          { className: 'ss-fieldlabel' },
          label,
          hint ? React.createElement('small', null, hint) : null,
        ),
        control,
      );
    const toggle = (key, label, hint, locked, checkedOverride) =>
      row(
        label,
        hint,
        React.createElement(Switch, {
          checked:
            typeof checkedOverride === 'boolean' ? checkedOverride : notifySettings[key] === true,
          label,
          disabled: notifyBusy || locked === true,
          title: hint,
          onChange: (value) => updateNotify({ [key]: value }),
        }),
      );
    // Like `toggle`, but the hint stays visible text only and the switch gets
    // no tooltip (used by rows whose explanation is already self-explanatory).
    const togglePlain = (key, label, hint, locked, checkedOverride) =>
      row(
        label,
        hint,
        React.createElement(Switch, {
          checked:
            typeof checkedOverride === 'boolean' ? checkedOverride : notifySettings[key] === true,
          label,
          disabled: notifyBusy || locked === true,
          onChange: (value) => updateNotify({ [key]: value }),
        }),
      );
    // Like `toggle`, but keeps the explanation as visible text instead of a
    // tooltip (used when the row already renders its own description). The
    // master switch passes its own onChange because it aggregates both channels.
    const toggleText = (key, label, hint, onChange) =>
      row(
        label,
        hint,
        React.createElement(Switch, {
          checked: notifySettings[key] === true,
          label,
          disabled: notifyBusy,
          onChange: onChange || ((value) => updateNotify({ [key]: value })),
        }),
      );
    // Channel switches sit stacked at the right edge of the "提醒方式" row:
    // label on the left of each switch, both switches right-aligned together.
    const channelSwitch = (checked, label, hint, onChange) =>
      React.createElement(
        'div',
        { className: 'ss-channel' },
        React.createElement('span', { className: 'ss-channellabel' }, label),
        React.createElement(Switch, {
          checked,
          label,
          title: hint,
          disabled: notifyBusy,
          onChange,
        }),
      );
    // The master switch is the aggregate of the two channels: turning it off
    // clears both, turning it on restores the last non-empty combination, and
    // the last channel going off flips it off (normalize keeps that invariant).
    const setMaster = (on) => {
      if (!on) {
        updateNotify({ enabled: false, system: false, sound: 'none' });
        return;
      }
      const last = notifySettings.lastChannels;
      updateNotify({ enabled: true, system: last.banner, sound: last.sound ? 'system' : 'none' });
    };
    const setChannel = (field, value) => {
      const banner = field === 'banner' ? value : notifySettings.system;
      const soundOn = field === 'sound' ? value : notifySettings.sound !== 'none';
      const anyOn = banner || soundOn;
      updateNotify({
        system: banner,
        sound: soundOn ? 'system' : 'none',
        enabled: anyOn,
        lastChannels: anyOn ? { banner, sound: soundOn } : notifySettings.lastChannels,
      });
    };
    const bannerChannel = channelSwitch(
      notifySettings.system,
      t('notifyChannelBanner'),
      t('notifySystemHint'),
      (value) => setChannel('banner', value),
    );
    const soundChannel = channelSwitch(
      notifySettings.sound !== 'none',
      t('notifyChannelSound'),
      t('notifySoundHint'),
      (value) => setChannel('sound', value),
    );
    const soundRow = (group, label) => {
      const entry = notifySettings.sounds[group] || { name: '' };
      const subtitle = entry.name ? entry.name : t('notifySoundDefault');
      return React.createElement(
        'div',
        { className: 'ss-soundrow', key: `${group}-${label}` },
        React.createElement('span', { className: 'ss-soundicon' }, React.createElement(NoteIcon, { size: 14 })),
        React.createElement(
          'div',
          { className: 'ss-soundmain' },
          React.createElement('div', { className: 'ss-soundlabel' }, label),
          React.createElement('div', { className: 'ss-soundsub' }, subtitle),
        ),
        React.createElement(
          'div',
          { className: 'ss-soundactions' },
          React.createElement(
            Tip,
            { text: t('notifySoundPlay') },
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'ss-iconbtn ss-soundbtn',
                onClick: () => previewNotifySound(group === 'interrupt' ? 'error' : 'done'),
                disabled: notifyBusy,
              },
              React.createElement(PlayIcon, { size: 15 }),
            ),
          ),
          React.createElement(
            Tip,
            { text: t('notifySoundPick') },
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'ss-iconbtn ss-soundbtn',
                onClick: () => pickNotifySound(group),
                disabled: notifyBusy,
              },
              React.createElement(UploadIcon, { size: 15 }),
            ),
          ),
          entry.name
            ? React.createElement(
                Tip,
                { text: t('notifySoundClear') },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'ss-iconbtn ss-soundbtn',
                    onClick: () => clearNotifySound(group),
                    disabled: notifyBusy,
                  },
                  React.createElement(ResetIcon, { size: 15 }),
                ),
              )
            : null,
        ),
      );
    };
    return React.createElement(
      'div',
      null,
      React.createElement('div', { className: 'ss-hint ss-notifyintro' }, t('notifySubtitle')),
      React.createElement(
        'div',
        { className: 'ss-card ss-notifycard' },
        React.createElement('h4', null, t('notifyPermission')),
        React.createElement(
          'div',
          { className: 'ss-kpis ss-permissionstate' },
          React.createElement('span', { className: `ss-permission ${permission}` }, permissionText),
        ),
        React.createElement(
          'div',
          { className: 'ss-notifyactions' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ss-btn',
              disabled: notifyBusy || permission === 'granted' || permission === 'unsupported',
              onClick: grantNotifications,
            },
            t('notifyRequestPermission'),
          ),
          React.createElement(
            'button',
            { type: 'button', className: 'ss-btn quiet', onClick: sendTestNotification },
            t('notifyTest'),
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'ss-card ss-notifycard' },
        React.createElement('h4', null, t('notifyTitle')),
        toggleText('enabled', t('notifyEnabled'), t('notifyEnabledHint'), setMaster),
        row(
          t('notifyChannels'),
          t('notifyChannelsHint'),
          React.createElement('div', { className: 'ss-channelrow' }, bannerChannel, soundChannel),
          soundOn ? undefined : { borderBottom: 'none' },
        ),
        React.createElement(
          Collapse,
          { open: soundOn },
          row(
            t('notifyVolume'),
            null,
            React.createElement(
              'div',
              { className: 'ss-volumewrap' },
              React.createElement('input', {
                type: 'range',
                className: 'ss-volumerange',
                min: 0,
                max: 100,
                step: 1,
                value: notifySettings.volume,
                disabled: notifyBusy,
                onChange: (event) => updateNotify({ volume: Number(event.target.value) }),
              }),
              React.createElement('input', {
                type: 'number',
                className: 'ss-volumenum',
                min: 0,
                max: 100,
                step: 1,
                value: notifySettings.volume,
                disabled: notifyBusy,
                onChange: (event) => {
                  const next = Number(event.target.value);
                  updateNotify({
                    volume: Number.isFinite(next) ? Math.max(0, Math.min(100, Math.round(next))) : 100,
                  });
                },
              }),
              React.createElement('span', { className: 'ss-volumeunit' }, '%'),
            ),
            { alignItems: 'center', paddingTop: '14px', paddingBottom: '14px' },
          ),
          React.createElement('div', { className: 'ss-subhead ss-tonehead' }, t('notifySounds')),
          soundRow('normal', t('notifyDone')),
          soundRow('normal', t('notifyAsk')),
          soundRow('interrupt', t('notifyInterrupt')),
        ),
        // The behavior block follows the master switch only: turning the sound
        // channel off must not hide it. While the master switch is off it
        // collapses along with everything else and shows the switch as off.
        React.createElement(
          Collapse,
          { open: notifySettings.enabled },
          React.createElement(
            'div',
            { className: 'ss-subhead ss-behaviorsub' },
            t('notifyBehavior'),
          ),
          togglePlain(
            'openOnClick',
            t('notifyOpenOnClick'),
            t('notifyOpenOnClickHint'),
            false,
            notifySettings.enabled && notifySettings.openOnClick,
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'ss-notifyfooter' },
        React.createElement(
          'button',
          { type: 'button', className: 'ss-btn quiet', onClick: resetNotify, disabled: notifyBusy || notifyDefaults },
          t('notifyReset'),
        ),
      ),
      React.createElement('input', {
        type: 'file',
        accept: 'audio/mpeg,audio/wav,audio/ogg',
        ref: notifyFileRef,
        style: { display: 'none' },
        onChange: (event) => {
          const file = event.target.files && event.target.files[0];
          void uploadNotifySound(pendingSoundGroupRef.current, file);
        },
      }),
    );
  };

  const tabs = [
    { id: 'sessions', label: `${t('tabSessions')} (${sessions.length})` },
    { id: 'notify', label: t('tabNotify') },
    { id: 'panels', label: t('tabPanels') },
    { id: 'trash', label: `${t('tabTrash')} (${trash.length})` },
  ];

  if (loadError && !boot) {
    return React.createElement(
      'div',
      { className: 'ss-root' },
      React.createElement(
        'div',
        { className: 'ss-page' },
        React.createElement('div', { className: 'ss-error' }, t('loadFailed').replace('{msg}', loadError)),
        React.createElement('button', { type: 'button', className: 'ss-btn', onClick: refresh }, t('retry')),
      ),
    );
  }

  const handleRootScroll = (event) => {
    const top = event && event.currentTarget ? event.currentTarget.scrollTop : 0;
    const next = top > 480;
    if (next !== showBackTop) setShowBackTop(next);
  };

  const backToTop = () => {
    const node = tab === 'panels' ? panelsListRef.current : paneRef.current || rootRef.current;
    if (!node) return;
    if (typeof node.scrollTo === 'function') node.scrollTo({ top: 0, behavior: 'smooth' });
    else node.scrollTop = 0;
  };

  return React.createElement(
    'div',
    { className: 'ss-root ss-main', ref: rootRef, onScroll: handleRootScroll },
    React.createElement(
      'div',
      { className: 'ss-page ss-page-main' },
      React.createElement(
        'div',
        { className: 'ss-head' },
        React.createElement(
          'div',
          { className: 'ss-headmain' },
          React.createElement(Logo, { size: 36 }),
          React.createElement(
            'div',
            null,
            React.createElement('h1', { className: 'ss-title' }, t('mainTitle')),
            React.createElement('div', { className: 'ss-sub' }, t('mainSubtitle')),
          ),
        ),
        React.createElement(
          'div',
          { className: 'ss-headside' },
          React.createElement(
            'div',
            { className: 'ss-actions' },
            runningCount > 0 ? React.createElement('span', { className: 'ss-badge running' }, `${t('running')} ${runningCount}`) : null,
            busy ? React.createElement('span', { className: 'ss-badge' }, t('busy')) : null,
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ss-iconbtn',
              'aria-label': t('settingsHint'),
              onClick: openSettings,
            },
            React.createElement(GearIcon, { size: 16 }),
          ),
        ),
      ),
      hidden.has(PANEL_ID)
        ? React.createElement(
            'div',
            { className: 'ss-banner' },
            React.createElement('span', null, t('entryHidden')),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'ss-btn',
                onClick: () => {
                  const next = new Set(hidden);
                  next.delete(PANEL_ID);
                  saveHidden(next);
                },
              },
              t('showEntry'),
            ),
          )
        : null,
      React.createElement(
        'div',
        { className: 'ss-tabs', role: 'tablist' },
        tabs.map((item) =>
          React.createElement(
            'button',
            {
              key: item.id,
              type: 'button',
              role: 'tab',
              'aria-selected': tab === item.id ? 'true' : 'false',
              className: cx('ss-tab', tab === item.id && 'active'),
              onClick: () => {
                setTab(item.id);
                setShowBackTop(false);
              },
            },
            item.label,
          ),
        ),
      ),
      !boot
        ? React.createElement(BootstrapSkeleton)
        : React.createElement(
            'div',
            { key: tab, className: 'ss-pane ss-pane-main ss-fade' },
            tab === 'panels'
              ? React.createElement('div', { className: 'ss-panelswrap' }, renderPanelsTab())
              : React.createElement(
                  'div',
                  { className: 'ss-tabscroll', ref: paneRef, onScroll: handleRootScroll },
                  React.createElement(
                    'div',
                    { className: 'ss-tabinner' },
                    tab === 'sessions'
                      ? renderSessionsTab()
                      : tab === 'trash'
                        ? renderTrashTab()
                        : renderNotifyTab(),
                  ),
                ),
          ),
    ),
    confirm
      ? React.createElement(ConfirmDialog, {
          t,
          title: confirm.title,
          body: confirm.body,
          danger: confirm.danger === true,
          onCancel: () => setConfirm(null),
          onConfirm: confirm.onConfirm,
        })
      : null,
    exportTarget
      ? React.createElement(ExportDialog, {
          t,
          formats: EXPORT_FORMATS,
          format: exportFormat,
          fileName: exportFileNameFor(exportTarget, exportFormat),
          busy,
          onFormat: setExportFormat,
          onCancel: () => setExportTarget(null),
          onConfirm: runExport,
          onSetDefault: saveExportDefault,
        })
      : null,
    showBackTop
      ? React.createElement(
          Tip,
          { text: t('backToTop') },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ss-backtop',
              'aria-label': t('backToTop'),
              onClick: backToTop,
            },
            React.createElement(ArrowUpIcon, { size: 16 }),
          ),
        )
      : null,
    toast
      ? React.createElement(Toast, {
          text: toast.text,
          actionLabel: toast.undoValue ? t('undo') : null,
          onAction: undo,
          onMouseEnter: () => setToastHovered(true),
          onMouseLeave: () => setToastHovered(false),
        })
      : null,
  );
}

/* ---------------------------------------------------------- settings page */

function SettingsPage(props) {
  const { t, bridge } = props;
  const [boot, setBoot] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const value = await bridge.api('bootstrap', {});
        if (alive) {
          setBoot(value);
          setError(null);
        }
      } catch (loadError) {
        if (alive) setError(loadError?.message || String(loadError));
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  React.useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const settings = boot?.state?.settings ?? { defaultDeleteMode: 'trash', confirmPurge: true };
  const hidden = new Set(boot?.state?.hiddenPanels ?? []);
  const paths = boot?.paths ?? {};
  const version = boot?.version ?? '0.1.2';
  const trashCount = Array.isArray(boot?.trash) ? boot.trash.length : 0;

  const call = async (work, message) => {
    setBusy(true);
    try {
      await work();
      if (message) setToast({ text: message });
      setReloadKey((key) => key + 1);
    } catch (callError) {
      setToast({ text: callError?.message || String(callError) });
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = (patch) =>
    call(async () => {
      await bridge.api('saveSettings', { settings: patch });
    }, t('settingsSaved'));

  const setDeleteMode = (mode) => saveSettings({ defaultDeleteMode: mode });
  const setConfirmPurge = (value) => saveSettings({ confirmPurge: value });

  const exportFormatOptions = [
    { id: 'md', labelKey: 'exportFormatMd' },
    { id: 'txt', labelKey: 'exportFormatTxt' },
    { id: 'html', labelKey: 'exportFormatHtml' },
    { id: 'jsonl', labelKey: 'exportFormatJsonl' },
    { id: 'zstd', labelKey: 'exportFormatZstd' },
  ];
  const setDefaultExportFormat = (format) => saveSettings({ defaultExportFormat: format });

  const clearTranslations = () =>
    call(async () => {
      await bridge.api('clearTranslationCache', {});
    }, t('translationCacheCleared'));

  const openDataDirectory = () =>
    call(async () => {
      const value = await bridge.api('openWorkspacePath', { path: paths.dataDir });
      if (!value || value.opened !== true) throw new Error(t('openDataDirFailed'));
    });

  const setEntryVisible = (visible) =>
    call(async () => {
      const next = new Set(hidden);
      if (visible) next.delete(PANEL_ID);
      else next.add(PANEL_ID);
      await bridge.api('setHiddenPanels', { hiddenPanels: [...next] });
      bridge.applyHide([...next], bridge.listPanels());
    }, t('panelsSaved'));

  const resetSettings = () =>
    call(async () => {
      await bridge.api('resetSettings', {});
    }, t('resetSettingsDone'));

  const resetPanels = () =>
    call(async () => {
      await bridge.api('resetPanels', {});
      bridge.applyHide([], bridge.listPanels());
    }, t('panelsSaved'));

  const emptyTrashNow = () =>
    call(async () => {
      await bridge.api('emptyTrash', {});
    }, t('trashEmptied'));

  const field = (label, hint, control) =>
    React.createElement(
      'div',
      { className: 'ss-field' },
      React.createElement('div', { className: 'ss-fieldlabel' }, label, hint ? React.createElement('small', null, hint) : null),
      control,
    );

  if (error && !boot) {
    return React.createElement(
      'div',
      { className: 'ss-root ss-settings' },
      React.createElement(
        'div',
        { className: 'ss-page ss-fade' },
        React.createElement('div', { className: 'ss-error' }, t('loadFailed').replace('{msg}', error)),
      ),
    );
  }

  return React.createElement(
    'div',
    { className: 'ss-root ss-settings' },
    React.createElement(
      'div',
      { className: 'ss-page ss-fade' },
      React.createElement(
        'div',
        { className: 'ss-settingshead' },
        React.createElement('h2', { className: 'ss-title' }, t('settingsTitle')),
        React.createElement('div', { className: 'ss-sub' }, t('settingsSubtitle')),
      ),
      !boot
        ? React.createElement('div', { className: 'ss-empty' }, t('loading'))
        : React.createElement(
            'div',
            null,
            field(
              t('defaultDeleteMode'),
              t(settings.defaultDeleteMode === 'archive' ? 'modeArchiveHint' : 'modeTrashHint'),
              React.createElement(
                'div',
                { className: 'ss-radios' },
                React.createElement(
                  'label',
                  { className: 'ss-radio' },
                  React.createElement('input', {
                    type: 'radio',
                    name: 'ss-delete-mode',
                    checked: settings.defaultDeleteMode !== 'archive',
                    disabled: busy,
                    onChange: () => setDeleteMode('trash'),
                  }),
                  t('modeTrash'),
                ),
                React.createElement(
                  'label',
                  { className: 'ss-radio' },
                  React.createElement('input', {
                    type: 'radio',
                    name: 'ss-delete-mode',
                    checked: settings.defaultDeleteMode === 'archive',
                    disabled: busy,
                    onChange: () => setDeleteMode('archive'),
                  }),
                  t('modeArchive'),
                ),
              ),
            ),
            field(
              t('confirmPurgeLabel'),
              t('confirmPurgeHint'),
              React.createElement(Switch, {
                checked: settings.confirmPurge !== false,
                label: t('confirmPurgeLabel'),
                disabled: busy,
                onChange: (value) => setConfirmPurge(value),
              }),
            ),
            field(
              t('entryVisible'),
              t('entryVisibleHint'),
              React.createElement(Switch, {
                checked: !hidden.has(PANEL_ID),
                label: t('entryVisible'),
                disabled: busy,
                onChange: (value) => setEntryVisible(value),
              }),
            ),
            field(
              t('exportDefaultFormat'),
              t('exportDefaultFormatHint'),
              React.createElement(
                'div',
                { className: 'ss-radios' },
                exportFormatOptions.map((option) =>
                  React.createElement(
                    'label',
                    { className: 'ss-radio', key: option.id },
                    React.createElement('input', {
                      type: 'radio',
                      name: 'ss-export-format',
                      checked: settings.defaultExportFormat === option.id,
                      disabled: busy,
                      onChange: () => setDefaultExportFormat(option.id),
                    }),
                    t(option.labelKey),
                  ),
                ),
              ),
            ),
            field(
              t('clearTranslationCache'),
              t('clearTranslationCacheHint'),
              React.createElement(
                'button',
                { type: 'button', className: 'ss-btn', disabled: busy, onClick: clearTranslations },
                t('clearTranslationCache'),
              ),
            ),
            field(
              t('openDataDir'),
              t('openDataDirHint'),
              React.createElement(
                'button',
                { type: 'button', className: 'ss-btn', disabled: busy || !paths.dataDir, onClick: openDataDirectory },
                t('openDataDir'),
              ),
            ),
            field(
              t('tabTrash'),
              trashCount > 0 ? t('trashHint') : t('emptyTrashDisabled'),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'ss-btn',
                  disabled: busy || trashCount === 0,
                  onClick: emptyTrashNow,
                },
                trashCount > 0 ? `${t('emptyTrash')} (${trashCount})` : t('emptyTrash'),
              ),
            ),
            React.createElement(
              'div',
              { className: 'ss-toolbar', style: { marginTop: 18 } },
              React.createElement('button', { type: 'button', className: 'ss-btn', disabled: busy, onClick: resetSettings }, t('resetSettings')),
              React.createElement('button', { type: 'button', className: 'ss-btn ghost', disabled: busy, onClick: resetPanels }, t('resetPanels')),
            ),
            React.createElement(
              'div',
              { className: 'ss-card', style: { marginTop: 20 } },
              React.createElement('h4', null, t('about')),
              React.createElement('div', { className: 'ss-kpis', style: { marginBottom: 8 } }, t('version').replace('{v}', String(version))),
              React.createElement('div', { className: 'ss-kpis' }, t('dataDir')),
              React.createElement('div', { className: 'ss-mono' }, String(paths.dataDir ?? '')),
              React.createElement('div', { className: 'ss-kpis', style: { marginTop: 6 } }, t('trashDir')),
              React.createElement('div', { className: 'ss-mono' }, String(paths.trashDir ?? paths.dataDir ?? '')),
              React.createElement('div', { className: 'ss-kpis', style: { marginTop: 6 } }, t('sessionsRoot')),
              React.createElement('div', { className: 'ss-mono' }, String(paths.sessionsRoot ?? '')),
            ),
          ),
      toast ? React.createElement(Toast, { text: toast.text }) : null,
    ),
  );
}

/* --------------------------------------------------------------- apply */

function apply(ctx) {
  migrateLegacyStorage();
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, DICT), 'dsh-keeper: dictionaries');

  ctx.effect(
    () => {
      const style = document.createElement('style');
      style.id = 'dsh-keeper-style';
      style.textContent = CSS;
      document.head.appendChild(style);
      return () => style.remove();
    },
    'dsh-keeper: styles',
  );

  const hideStyle = document.createElement('style');
  hideStyle.id = 'dsh-keeper-hide';
  document.head.appendChild(hideStyle);
  ctx.effect(
    () => () => {
      hideStyle.remove();
    },
    'dsh-keeper: hide styles',
  );

  // The settings nav glyph is slot content now: `settings.section.icon` is a
  // keyed-by-section-id list owned by the settings shell (DSH >= 0.2.2), which
  // renders the matching registration in place of its generic gear fallback.

  const setHideRules = (rules) => {
    hideStyle.textContent = [...new Set((rules ?? []).filter(Boolean))].join('\n');
  };

  const rowRule = (selector, label) =>
    `${selector}[aria-label="${cssAttr(label)}"]{display:none!important}`;

  // Other plugins may also register rows into the More menu. Their rows are not
  // ours to toggle, so an auto-hidden More would bury them too.
  const hasForeignMoreRows = () => {
    try {
      if (!ctx.slots || typeof ctx.slots.entriesOfSlot !== 'function') return false;
      const entries = ctx.slots.entriesOfSlot('sidebar.panellist.actions') ?? [];
      return entries.some((entry) => {
        const options = entry && typeof entry === 'object' && entry.options ? entry.options : entry;
        const id = String(options?.id ?? '');
        return id !== '' && id !== 'entry-customization';
      });
    } catch {
      return false;
    }
  };

  const registerMoreMenuRowMarkers = () => {
    const labelsFor = () => ({
      browse: [t('moreBrowse'), 'Browse other plugins', '浏览更多插件'],
      create: [t('moreCreate'), 'Create your plugin', '创建你的插件'],
    });
    const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    let frame = 0;
    const sync = () => {
      frame = 0;
      const labels = labelsFor();
      const nodes = document.querySelectorAll(
        '[class*="moreMenu"] button, [class*="moreMenu"] [role="menuitem"]',
      );
      nodes.forEach((node) => {
        const text = norm(node.textContent);
        let row = '';
        if (labels.browse.some((label) => text.includes(norm(label)))) row = 'browse';
        else if (labels.create.some((label) => text.includes(norm(label)))) row = 'create';
        if (row) node.setAttribute(MORE_ROW_MARKER, row);
        else node.removeAttribute(MORE_ROW_MARKER);
      });
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(sync);
    };
    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const offLocale = typeof ctx.locale.subscribe === 'function' ? ctx.locale.subscribe(schedule) : () => {};
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      try {
        offLocale();
      } catch {
        /* ignore */
      }
      document.querySelectorAll(`[${MORE_ROW_MARKER}]`).forEach((el) => el.removeAttribute(MORE_ROW_MARKER));
    };
  };
  ctx.effect(() => registerMoreMenuRowMarkers(), 'dsh-keeper: more menu row markers');

  // Some controls still carry the native `title` attribute (tags, switches,
  // disabled buttons). Replace the browser popup with the same bubble, the same
  // TIP_DELAY and the same geometry the React Tip component uses.
  const registerNativeTitleTips = () => {
    if (typeof document === 'undefined' || !document.body) return () => {};
    const bubble = document.createElement('div');
    bubble.className = 'ss-tip';
    bubble.setAttribute('role', 'tooltip');
    bubble.setAttribute('data-side', 'top');
    bubble.style.visibility = 'hidden';
    document.body.appendChild(bubble);
    let active = null;
    let frame = 0;
    let timer = 0;
    let shown = false;

    const restore = () => {
      if (!active) return;
      const saved = active.getAttribute('data-ss-saved-title');
      if (saved !== null) {
        active.setAttribute('title', saved);
        active.removeAttribute('data-ss-saved-title');
      }
    };
    const hide = () => {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
      bubble.style.visibility = 'hidden';
      bubble.textContent = '';
      shown = false;
      restore();
      active = null;
    };
    const place = () => {
      frame = 0;
      if (!shown || !active || !bubble.textContent) return;
      const layout = computeTipLayout(active.getBoundingClientRect(), bubble);
      bubble.setAttribute('data-side', layout.side);
      bubble.style.left = `${layout.left}px`;
      bubble.style.top = `${layout.top}px`;
      bubble.style.visibility = 'visible';
    };
    const schedule = () => {
      if (!shown || frame) return;
      frame = requestAnimationFrame(place);
    };
    const closestTitle = (target) => (target && typeof target.closest === 'function' ? target.closest('[title]') : null);
    const arm = (node) => {
      const text = node.getAttribute('title');
      if (!text) return;
      active = node;
      node.setAttribute('data-ss-saved-title', text);
      node.removeAttribute('title');
      bubble.textContent = text;
      shown = false;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = 0;
        shown = true;
        place();
      }, TIP_DELAY);
    };
    const over = (event) => {
      const node = closestTitle(event.target);
      if (!node || node.closest('[data-tip]') || !node.closest('.ss-root')) return;
      if (node === active) return;
      hide();
      arm(node);
    };
    const out = (event) => {
      if (!active) return;
      if (event.relatedTarget && typeof active.contains === 'function' && active.contains(event.relatedTarget)) return;
      hide();
    };
    const onfocus = (event) => {
      const node = closestTitle(event.target);
      if (!node || node.closest('[data-tip]') || !node.closest('.ss-root')) return;
      hide();
      arm(node);
    };
    document.addEventListener('mouseover', over, true);
    document.addEventListener('mouseout', out, true);
    document.addEventListener('focusin', onfocus, true);
    document.addEventListener('focusout', out, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', over, true);
      document.removeEventListener('mouseout', out, true);
      document.removeEventListener('focusin', onfocus, true);
      document.removeEventListener('focusout', out, true);
      window.removeEventListener('scroll', hide, true);
      if (frame) cancelAnimationFrame(frame);
      hide();
      bubble.remove();
    };
  };
  ctx.effect(() => registerNativeTitleTips(), 'dsh-keeper: native title tooltips');

  const getLocaleId = () => {
    try {
      const snapshot = ctx.locale.getSnapshot();
      const id =
        snapshot?.active ??
        snapshot?.id ??
        snapshot?.locale ??
        snapshot?.lang ??
        snapshot?.language;
      if (typeof id === 'string' && id) return id;
    } catch {
      /* fall through */
    }
    try {
      const locale = typeof ctx.locale.getLocale === 'function' ? ctx.locale.getLocale() : null;
      const id = typeof locale === 'string' ? locale : locale?.active;
      if (typeof id === 'string' && id) return id;
    } catch {
      /* fall through */
    }
    return 'en';
  };

  const listPanels = () => {
    let entries = [];
    try {
      if (ctx.slots && typeof ctx.slots.entriesOfSlot === 'function') {
        entries = ctx.slots.entriesOfSlot('sidebar.panellist') ?? [];
      }
    } catch {
      entries = [];
    }
    const locale = getLocaleId();
    // entriesOfSlot yields StoredEntry records ({component, options, ...}); older
    // builds handed the flat options object, so accept both shapes.
    return entries
      .map((entry) => {
        const options = entry && typeof entry === 'object' && entry.options ? entry.options : entry;
        return {
          id: String(options?.id ?? ''),
          order: Number(options?.order ?? 100),
          label: resolveLabel(options, t, locale),
          component: entry && entry.component ? entry.component : null,
          registrant: entry && typeof entry.registrant === 'string' ? entry.registrant : '',
        };
      })
      .filter((panel) => panel.id !== '')
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  };

  let lastHidden = [];

  const applyHide = (hiddenIds, panels) => {
    const set = new Set((hiddenIds ?? []).filter((id) => typeof id === 'string'));
    lastHidden = [...set];
    const rules = [];
    for (const panel of panels ?? listPanels()) {
      if (set.has(panel.id)) {
        rules.push(rowRule('button[class*="panelRow"]', panel.label || panel.id));
      }
    }
    const moreChildrenVisible = !set.has(MORE_ROW_BROWSE) || !set.has(MORE_ROW_CREATE);
    const moreHidden =
      set.has(MORE_PANEL_ID) || (!moreChildrenVisible && !hasForeignMoreRows());
    if (moreHidden) {
      // The More launcher carries the sidebar's own localized label.
      for (const label of ['更多', 'More']) {
        rules.push(rowRule('button[class*="panelRow"]', label));
      }
    }
    if (set.has(MORE_ROW_BROWSE)) {
      rules.push(`[${MORE_ROW_MARKER}="browse"]{display:none!important}`);
    }
    if (set.has(MORE_ROW_CREATE)) {
      rules.push(`[${MORE_ROW_MARKER}="create"]{display:none!important}`);
    }
    setHideRules(rules);
  };

  const subscribePanels = (callback) => {
    const offs = [];
    const wrap = (register) => {
      try {
        const off = register();
        if (typeof off === 'function') offs.push(off);
      } catch {
        /* slot/locale subscription is optional */
      }
    };
    wrap(() => ctx.slots.subscribe('sidebar.panellist', callback));
    wrap(() => ctx.slots.subscribe('sidebar.panellist.actions', callback));
    wrap(() => ctx.locale.subscribe(callback));
    return () => {
      for (const off of offs) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
    };
  };

  const api = async (method, payload) => {
    let url;
    try {
      url = new URL(`${API_BASE}${method}`, document.baseURI).toString();
    } catch {
      url = `${API_BASE}${method}`;
    }
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!data || data.ok !== true) {
      throw new Error(data?.error?.message || `HTTP ${response.status}`);
    }
    return data.value;
  };

  const openSession = async (sessionId) => {
    try {
      if (ctx.uiWorkspace && typeof ctx.uiWorkspace.openSession === 'function') {
        const result = ctx.uiWorkspace.openSession(sessionId);
        if (result && typeof result.then === 'function') await result;
        return true;
      }
    } catch (error) {
      console.warn('[dsh-keeper] openSession failed:', error);
    }
    /* Never fall back to selecting the conversation panel: that would show a
       fresh blank session instead of the one the user asked for. */
    return false;
  };

  const openPanel = (panelId) => {
    try {
      if (ctx.layout && typeof ctx.layout.selectPanel === 'function') {
        ctx.layout.selectPanel(panelId);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  };

  const copyText = async (text) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(String(text));
      }
    } catch {
      /* clipboard is optional */
    }
  };

  /**
   * Open the host settings modal on our section. The shell owns the modal state
   * in a slot-scoped store (`sidebar.settings` → `store.actions.openSection`)
   * and exposes no client service, so resolve that store through the slot host
   * face; if the internals move, click the host's own sidebar trigger and pick
   * our marked nav row once the dialog mounts. Returns false when neither path
   * exists, letting the caller fall back to the hint toast.
   */
  const openSettings = () => {
    try {
      const slots = ctx.slots;
      const entries = slots && typeof slots.entriesOfSlot === 'function' ? slots.entriesOfSlot('sidebar.settings') : null;
      const entry = (entries || []).find((candidate) => candidate && candidate.store !== undefined);
      const host = slots && typeof slots.hostFace === 'function' ? slots.hostFace() : null;
      const store = host && typeof host.storeOf === 'function' && entry ? host.storeOf(entry) : null;
      const actions = store && store.actions;
      if (actions && typeof actions.openSection === 'function') {
        actions.openSection(PANEL_ID);
        return true;
      }
      if (actions && typeof actions.open === 'function') {
        actions.open();
        return true;
      }
    } catch (error) {
      console.warn('[dsh-keeper] settings store route unavailable:', error);
    }

    try {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return false;
      const trigger =
        document.querySelector('[class*="settingsArea"] button[aria-haspopup="dialog"]') ||
        document.querySelector('button[aria-haspopup="dialog"][aria-keyshortcuts]');
      if (!trigger || typeof trigger.click !== 'function') return false;
      trigger.click();
      let attempts = 0;
      const focusSection = () => {
        if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
        if (!document.querySelector('[role="dialog"]')) {
          attempts += 1;
          if (attempts < 40 && typeof requestAnimationFrame === 'function') requestAnimationFrame(focusSection);
          return;
        }
        const wanted = String(t('settingsNav') ?? '').replace(/\s+/g, '');
        let nav = null;
        document.querySelectorAll('[role="dialog"] nav button').forEach((button) => {
          if (wanted !== '' && String(button.textContent ?? '').replace(/\s+/g, '').endsWith(wanted)) {
            nav = button;
          }
        });
        if (nav && typeof nav.click === 'function') {
          nav.click();
          return;
        }
        attempts += 1;
        if (attempts < 40 && typeof requestAnimationFrame === 'function') requestAnimationFrame(focusSection);
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusSection);
      return true;
    } catch (error) {
      console.warn('[dsh-keeper] settings trigger fallback unavailable:', error);
      return false;
    }
  };

  // Remember which plugins owned a sidebar panel, so a plugin disabled at
  // runtime can keep its row (and Enable button) even after a page reload.
  const PANEL_MEMORY_KEY = 'dsh-keeper:panel-memory';
  const readPanelMemory = () => {
    try {
      const raw = window.localStorage.getItem(PANEL_MEMORY_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  };
  const writePanelMemory = (entries) => {
    try {
      window.localStorage.setItem(PANEL_MEMORY_KEY, JSON.stringify(entries));
    } catch (error) {
      // Best effort only: the in-memory map still works for this session.
    }
  };

  const bridge = {
    api,
    listPanels,
    getLocaleId,
    openPanel,
    openSettings,
    copyText,
    applyHide,
    subscribePanels,
    hasForeignMoreRows,
    openSession,
    panelMemory: readPanelMemory(),
    rememberPanels: writePanelMemory,
    ...makeStyles(),
  };

  /** Register without taking the whole plugin down if a host lacks a slot. */
  const safeRegister = (options, component) => {
    try {
      return ctx.slots.register(options, component);
    } catch (error) {
      console.warn('[dsh-keeper] slot registration failed:', options?.name, error);
      return () => {};
    }
  };

  ctx.effect(
    () =>
      safeRegister(
        {
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 2,
          label: () => t('panelName'),
          locale: NS,
        },
        (owner) => React.createElement(PanelIcon, { size: owner?.size ?? 16, active: Boolean(owner?.active) }),
      ),
    'dsh-keeper: panel launcher',
  );

  ctx.effect(
    () =>
      safeRegister(
        {
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t, bridge }),
        },
        MainPanel,
      ),
    'dsh-keeper: main panel',
  );

  ctx.effect(
    () =>
      safeRegister(
        {
          name: 'settings.section',
          id: 'dsh-keeper',
          order: 60,
          label: () => t('settingsNav'),
          locale: NS,
          inject: () => ({ t, bridge }),
        },
        SettingsPage,
      ),
    'dsh-keeper: settings page',
  );

  // DSH >= 0.2.2: the settings shell asks `settings.section.icon` for the row
  // glyph, filtered by the matching settings.section id. Same mark as the
  // sidebar launcher, and no DOM patching needed.
  ctx.effect(
    () =>
      safeRegister(
        {
          name: 'settings.section.icon',
          id: 'dsh-keeper',
          locale: NS,
        },
        (owner) => React.createElement(PanelIcon, { size: owner?.size ?? 16, active: Boolean(owner?.active) }),
      ),
    'dsh-keeper: settings section icon',
  );

  ctx.effect(() => {
    const reapply = () => applyHide(lastHidden, listPanels());
    const off = subscribePanels(reapply);
    // Warms the module-level snapshot cache before the panel is first opened,
    // which also lets the hidden-panel CSS apply from the same response.
    loadBootstrap(bridge)
      .then((value) => {
        lastHidden = Array.isArray(value?.state?.hiddenPanels) ? value.state.hiddenPanels : [];
        reapply();
      })
      .catch(() => {
        /* the panel list stays visible when state cannot be read */
      });
    return off;
  }, 'dsh-keeper: hidden panel state');

  // Runs for the whole app session, not only while the plugin page is mounted.
  ctx.effect(() => startNotifier(bridge, t), 'dsh-keeper: notification notifier');
}

window.__ModuleLoader__.load({
  id: 'dsh-keeper-plugin',
  factory(require) {
    React = require('react');
    return { name: 'dsh-keeper', inject: ['slots', 'locale', 'theme', 'layout', 'sessions', 'uiWorkspace'], apply };
  },
});
})();
