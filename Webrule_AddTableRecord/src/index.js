/**
 * 新增指定实体记录
 * 要求：
 * 1. 要求对新增的记录设定默认值
 * 2. 要求能一次插入多条记录
 * 3、增加判断是否先保存实体数据的处理逻辑
 * 4、增加处理来源字段fieldType(1：字段，2：系统变量，3：组件变量，4：表达式)类型的逻辑
 * 5. 规则格式如下：
 * {
 *  "IsCreateRe":true,//是否保存实体数据对应开发系统：是否先保存数据库
 *  "AddLocation": "0","1", "2", "3" 分别代表选中行上方、下方、最前、最后
 *  NumCount": "1",    //新增的行数
 *  "MasterTable":"ssddff",//主表表名
 *  "TableName":"ffddss"//表名
 *  "TableID":"891e833172114720b4a8724aa91fc0fc",//表的ID
 *  "Mappings" : [{
 *      "srcField": "FieldData1", //目标字段
 *      "destField": "LLDW1" //来源字段
 *      "typeField":"1"//来源字段fieldType(1：字段，2：系统变量，3：组件变量，4：表达式)
 *  },{
 *      "destField": "FieldData2", //目标字段
 *      "ID": "922cc09ece364f6c91289119689527d7", //唯一标识
 *      "srcField": "LLDW2" //来源字段,
 *      "typeField":"2"//来源字段fieldType(1：字段，2：系统变量，3：组件变量，4：表达式)
 *  }]
 * }
 */

vds.import("vds.ds.*","vds.expression.*","vds.message.*","vds.window.*","vds.component.*","vds.log.*","vds.widget.*","vds.object.*");
var randomFuncNames = ["GenerateSequenceNumber","GenerateSequenceNumberQuick","GenerateUUID","GetSerialNumber","Random"];
/**
 * 给数据源插入记录的对象
 * @param dataSourceName 数据源
 * @param numCount  插入的条数
 */
function AddTableRecord(dataSourceName, numCount) {
    this.dataSourceName = dataSourceName;
    this.numCount = numCount;
};

var getFieldName = function (fieldName) {
    var retvalue = fieldName;
    if (fieldName.indexOf(".") != -1) {
        retvalue = fieldName.split(".")[1];
    }
    return retvalue;
};
/**
 * 判断表达式是否存在随机函数
 * @param	String	exp	表达式
 * */
var existRandomFunc = function (exp) {
    if (exp) {
        for (var i = 0, len = randomFuncNames.length; i < len; i++) {
            if (exp.indexOf(randomFuncNames[i]) != -1) {
                return true;
            }
        }
    }
    return false;
}

/**
 * 插入记录的方法
 * @param defaultValueCfg 插入记录的默认值，结构为json格式：
 * 如：[{"fieldName": tablename.fieldName1, "value":value2}]
 * @param position 插入记录的位置（相比选中行，具体的逻辑在对应控件的hanlder中处理）
 */
AddTableRecord.prototype.insertRecords = function (datasource, defaultValueCfg, position) {
    var insertRecords = [];
    for (var i = 0; i < this.numCount; i++) {
        var emptyRecord = datasource.createRecord();
        for (var j = 0; j < defaultValueCfg.length; j++) {
            var fieldName = getFieldName(defaultValueCfg[j]["fieldName"]);
            var defaultValue = defaultValueCfg[j]["value"];
            var context = defaultValueCfg[j]["context"];
            if (context) { //带随机函数的表达式每次都需要经过表达式引擎取结果
                defaultValue = vds.expression.execute(defaultValue, context);
            }
            emptyRecord.set(fieldName, defaultValue);
        }
        insertRecords.push(emptyRecord);
    }
    var actionMode = this.getActionMode(position,datasource);
    datasource.insertRecords(insertRecords,actionMode);
    return insertRecords;
};

/**
 * 获取插入的位置信息
 * @param position 位置参数
 * "0","1", "2", "3" 分别代表选中行上方、下方、最前、最后
 */
AddTableRecord.prototype.getActionMode = function (position,datasource) {
    var actionMode;
    switch (position) {
        case "0":
            actionMode = datasource.Position.Before;
            break;
        case "1":
            actionMode = datasource.Position.After;
            break;
        case "2":
            actionMode = datasource.Position.Top;
            break;
        case "3":
            actionMode = null;
            break;
        case "":
            actionMode = null;
            break;
        default:
            vds.log.warn("[AddTableRecord.getActionMode]插入位置不正确,传入的actionMode:" + position + ",自动适配成插入到最后");
            actionMode = null;
            break;
    }
    return actionMode;
}

/**
 * 是不是单值控件
 * @param dataSource 数据源名称
 * @return  widgetAttribute.storeType.SET | widgetAttribute.storeType.SINGLE_RECORD
 */
var isSingleStoreTypeByDataSource = function (dataSource) {
    var isSingle = true;
    var widgetIDs = vds.widget.getWidgetCodes(dataSource);
    if (!widgetIDs || (vds.object.isArray(widgetIDs) && widgetIDs.length <= 0)) {
        isSingle = false;
    } else {
        for (var i = 0; i < widgetIDs.length; i++) {
            var storeType = vds.widget.getStoreType(widgetIDs[i]);
            if (storeType == vds.widget.StoreType.Set || storeType == "menu" || storeType == "DataList") {
                isSingle = false;
                break;
            }
        }
    }
    return isSingle;
};
/**
 * 通过映射关系，获取新增记录的默认值 如果返回值包含context，表示值还需要执行一次表达式
 * @param mappings 映射信息
 * @param ruleContext 规则上下文
 * @return 结构为json格式：
 * 如：[{"fieldName": tablename.fieldName1, "value":value2}]
 */
var _getDefaultValue = function (datasource, mappings, ruleContext) {
    var returnValue = [];
    if (!mappings || mappings.length <= 0) {
        return returnValue;
    } else {
        for (var i = 0; i < mappings.length; i++) {
            var fieldValue = {};
            var srcField = mappings[i]["srcField"];
            var destField = mappings[i]["destField"];
            var fieldType = mappings[i]["fieldtype"];
            fieldValue["fieldName"] = getFieldName(destField);
            //如果是字段
            if (fieldType === '1') {
                var selected = datasource.getCurrentRecord();
                if (selected) {
                    var fieldName = srcField.substring(srcField.indexOf(".") + 1, srcField.length);
                    fieldValue["value"] = selected.get(fieldName);
                }
            } else if (fieldType === '2') {
                //如果是组件变量
                fieldValue["value"] = vds.component.getVariant(srcField);
            } else if (fieldType === '3') {
                //如果是窗体变量
                fieldValue["value"] = vds.window.getInput(srcField);
            } else if (fieldType === '4' || fieldType === "expression") {
                var context = {
                    ruleContext : ruleContext
                };
                if (existRandomFunc(srcField)) {
                    fieldValue["context"] = context;
                    fieldValue["value"] = srcField;
                } else {
                    //如果是表达式
                    fieldValue["value"] = vds.expression.execute(srcField,context);
                }
            }
            returnValue.push(fieldValue);
        }
    }
    return returnValue;
};
//规则主入口(必须有)
var main = function (ruleContext) {
    return new Promise(function(resolve,reject){
        var inParamsObj = ruleContext.getVplatformInput();
        var numCountFormula = inParamsObj["NumCount"];
        //初始值来源的映射信息
        var mappings = inParamsObj["Mappings"];
        //增加记录的数据源的主表
        var masterTable = inParamsObj["MasterTable"];
        //增加记录的数据源
        var tableName = inParamsObj["TableName"];
        //实体类型
        var EntityType = inParamsObj["TableType"];
        var position = inParamsObj["AddLocation"];
        if (!position) {
            position = "3";
        }
        var datasource = getDataSource(tableName, ruleContext, EntityType); //根据类型获取数据源
        var numCount = vds.expression.execute(numCountFormula,{
            ruleContext : ruleContext
        });
    
        if (isNaN(numCount)) {
            vds.message.error("表达式执行结果不合法，请检查表达式！");
            return resolve();
        }
        if (numCount <= 0) {
            return;
        }
        if (undefined == EntityType || EntityType == "window") {
            //判断是否是单值，是单值时清空原来的数据, 多值的话不需要清空
            var isSingle = isSingleStoreTypeByDataSource(tableName);
            if (isSingle) {
                datasource.clear(false);
                if (numCount > 1) {
                    vds.message.error("单值控件不允许一次插入多条数据！");
                    return resolve();
                }
            }
        }
    
        if (masterTable) { //如果主表不为空
            var ds = vds.ds.lookup(masterTable);
            var selectedData = ds.getCurrentRecord();
            if (!selectedData) {
                vds.message.error("新增记录发生错误：关联父表没有选中记录！");
                return resolve();
            }
        }
        var insertOper = new AddTableRecord(tableName, numCount);
        var defaultValue = _getDefaultValue(datasource, mappings, ruleContext);
        insertOper.insertRecords(datasource, defaultValue, position);
        resolve();
    });
};
/**
 * 获取数据源
 * @param ds 数据源名称
 * @param ruleContext 规则上下文
 * @param EntityType 实体类型
 */
var getDataSource = function (ds, ruleContext, EntityType) {
    var dsName = ds;
    var datasource = null;
    if (undefined == EntityType || EntityType == "window") {
        datasource = vds.ds.lookup(dsName);
    } else {
        switch (EntityType) {
            case "ruleSetInput":
                dsName = "BR_IN_PARENT." + dsName;
                break;
            case "ruleSetVar":
                dsName = "BR_VAR_PARENT." + dsName;
                break;
            case "ruleSetOutput":
                dsName = "BR_OUT_PARENT." + dsName;
                break;
        }
        datasource = vds.expression.execute(dsName,{
            "ruleContext": ruleContext
        });
    }
    if (!datasource){
        throw new Error("找不到参数中的实体！实体编码：" + dsName);
    }
    return datasource;
}

export {
    main
}