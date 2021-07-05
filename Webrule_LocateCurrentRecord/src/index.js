/**
 * 记录定位规则
 *  1、只用于界面实体已加载数据的查找，不会去后台查找数据
 *  2、查找条件通过表达式来描述
 *  3、可从当前行开始查找、或者从首行开始查找
 *  4、查找顺序可以正向、反向
 *  5、如果定位记录在当前界面可视，则仅仅改变当前行（高亮）,如果定位记录不可见，则把当前记录滚动到可视区域第一行并且高亮；对于树、树表控件，如果定位节点不可见，则会展开定位节点，并使其可视；
 *  6、此规则不改变多选表格/树的行选中状态；
 */
vds.import("vds.ds.*","vds.string.*","vds.widget.*","vds.expression.*","vds.exception.*","vds.log.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        try {
            var inParams = ruleContext.getVplatformInput();
            // 源实体
            var sourceName = inParams.sourceName;
            // 源实体过滤条件
            var condition = inParams.condition;
            // 是否当前行开始
            var isCurrentBegin = inParams.isCurrentBegin;
            // 正向、反向 true正向、false反向
            var searchSort = inParams.searchSort;
            var handleEvent = function () {
                // 取下一条实体记录
                var locateCurrRecord = _getLocateCurrEntityRecord(sourceName, condition, isCurrentBegin, searchSort,ruleContext);
                if (locateCurrRecord !== null) {
                    var datasource = vds.ds.lookup(sourceName);
                    var widgetId = vds.widget.getWidgetCodes(sourceName)
                    var widgetIds = [];
                    if (!(widgetId instanceof Array)) {
                        widgetIds.push(widgetId);
                    } else {
                        widgetIds = widgetId;
                    }
                    for (var _a = 0; _a < widgetIds.length; _a++) {
                        var type = vds.widget.getType(widgetIds[_a]);
                        if ("JGBizCodeTreeGrid" == type ||
                            "JGBizCodeTreeView" == type ||
                            "JGDataGrid" == type ||
                            "JGTreeGrid" == type ||
                            "JGTreeView" == type) {
                            vds.widget.execute(widgetIds[_a], 'locateRecord',[locateCurrRecord]);
                        }
                    }
                    // 设置当前实体
                    datasource.setCurrentRecord(locateCurrRecord);
                }
                resolve();
            }
            var tainFunc = ruleContext.genAsynCallback(handleEvent);
            setTimeout(tainFunc, 10);
        } catch (err) {
            reject(err);
        }
    });
}
var _getLocateCurrEntityRecord = function (sourceName, condition,isCurrentBegin, searchSort, ruleContext) {
    // 源记录集合
    var datasource = vds.ds.lookup(sourceName);
    if(!datasource){
        throw vds.exception.newConfigException("来源实体【"+sourceName+"】不存在，请检查配置.");
    }
    var records = datasource.getAllRecords();
    if (records)
        records = records.toArray();

    if (records.length == 0) {
        return null;
    }
    var allRecords = [];
    var currRecord = datasource.getCurrentRecord();
    var currRecordId = currRecord.getSysId();
    // 从当前行开始
    if (isCurrentBegin) {
        // 完整列表
        var locaRecordRecords = [];
        var find = false;
        var preArray = [];
        var lastArray = [];
        var nowArray = preArray;
        for(var i = 0,len = records.length;i<len;i++){
            var record = records[i];
            if(!find && record.getSysId() == currRecordId){
                find = true;
                nowArray = lastArray;
            }
            nowArray.push(record);
        }
        if(searchSort){
            allRecords = lastArray;
            locaRecordRecords = preArray;
        }else{
            allRecords = preArray.reverse();
            locaRecordRecords = lastArray.reverse();
        }
        // 还原完整的列表
        allRecords = allRecords.concat(locaRecordRecords);
    } else {
        // 查找顺序正向
        if (searchSort) {
            allRecords = records;
        } else {
            // 查找顺序反向
            allRecords = records.reverse();
        }
    }

    if (allRecords == null || allRecords.length == 0) {
        vds.log.warn("实体【"+sourceName+"】没有符合条件的记录！");
        return null;
    }

    // 如果只有一条记录
    if (allRecords.length == 1) {
        return allRecords[0];
    }

    if (condition == null || vds.string.trim(condition) === "\"\"") {
        return allRecords[0];
    }

    // 过滤后的记录集合
    for (var i = 0; i < allRecords.length; i++) {
        var record = allRecords[i];

        try {
            var ret = vds.expression.execute(condition, {
                "records":[record],
                "ruleContext": ruleContext
            });
            if (typeof ret != "boolean") {
                throw vds.exception.newConfigException("条件必须返回布尔类型");
            }
            // 条件满足
            if (ret == true) {
                if (isCurrentBegin) { //从当前行开始查找
                    if (record.getSysId() != currRecordId) { //须剔除当前行
                        return record;
                    }
                } else {
                    return record;
                }
            }
        } catch (e) {
            var message = "表达式执行错误！condition=" + condition + "错误信息：" + e.message;
            vds.log.error(message);
            throw vds.exception.newConfigException("实体过滤条件不正确！" + message);
        }
    }
    //没有匹配记录时，从当前行开始查找方式返回当前行，否则返回第一条记录
    return isCurrentBegin ? currRecord : records[0];
};

exports.main = main;

export {
    main
}