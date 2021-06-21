/**
 * ============记录定位规则 1、只用于界面实体已加载数据的查找，不会去后台查找数据； 2、查找条件通过表达式来描述；
 * 3、可从当前行开始查找、或者从首行开始查找； 4、查找顺序可以正向、反向； 5、如果定位记录在当前界面可视，则仅仅改变当前行（高亮）；
 * 如果定位记录不可见，则把当前记录滚动到可视区域第一行并且高亮；对于树、树表控件，如果定位节点不可见，则会展开定位节点，并使其可视；
 * 6、此规则不改变多选表格/树的行选中状态；
 * 
 * 示例： 表达式配置为： Contains( [UserInfo].[userName], “张” ) ，将定位到包含“张”的第1条匹配记录；
 * 
 * @author kuangxw
 * @createDate 2013-08-30
 */

    var log;
    var jsonUtil;
    var stringUtil;
    var manager;
    var widgetContext;
    var ExpressionContext;
    var engine;
    var widgetAction;
    var windowVMManager;
    var scopeManager;

    exports.initModule = function(sBox) {
        jsonUtil = sBox
                .getService("vjs.framework.extension.util.JsonUtil");
        stringUtil = sBox
                .getService("vjs.framework.extension.util.StringUtil");
        log = sBox.getService("vjs.framework.extension.util.log");
        manager = sBox
                .getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
        widgetContext = sBox
                .getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
        ExpressionContext = sBox
                .getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
        engine = sBox
                .getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
        widgetAction = sBox
                .getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
        windowVMManager = sBox
                .getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
        scopeManager = sBox
                .getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
    }

    var main = function(ruleContext) {
        var inParams = jsonUtil
                .json2obj(ruleContext.getRuleCfg().inParams);
        // 源实体
        var sourceName = inParams.sourceName;
        // 源实体过滤条件
        var condition = inParams.condition;
        // 是否当前行开始
        var isCurrentBegin = inParams.isCurrentBegin;
        // 正向、反向 true正向、false反向
        var searchSort = inParams.searchSort;
        ruleContext.markRouteExecuteUnAuto();
        // 获取当前域id
        var scopeId = scopeManager.getCurrentScopeId();
        var handleEvent = function() {
            // 开启域
            scopeManager.openScope(scopeId);
            // 取下一条实体记录
            var locateCurrRecord = _getLocateCurrEntityRecord(
                    sourceName, condition, isCurrentBegin, searchSort,
                    ruleContext.getRouteContext());
            if (locateCurrRecord !== null) {
                var datasource = manager.lookup({
                    "datasourceName" : sourceName
                });
                var widgetId = windowVMManager
                        .getWidgetCodesByDatasourceName({
                            "datasourceName" : sourceName
                        })
                var widgetIds = [];
                if (locateCurrRecord) {
                    if (!(widgetId instanceof Array)) {
                        widgetIds.push(widgetId);
                    } else {
                        widgetIds = widgetId;
                    }
                    for (var _a = 0; _a < widgetIds.length; _a++) {
                        var type = widgetContext.getType(widgetIds[_a]);
                        if ("JGBizCodeTreeGrid" == type
                                || "JGBizCodeTreeView" == type
                                || "JGDataGrid" == type
                                || "JGTreeGrid" == type
                                || "JGTreeView" == type) {
                            widgetAction.executeWidgetAction(
                                    widgetIds[_a], 'locateRecord',
                                    locateCurrRecord);
                        }
                    }
                    // 设置当前实体
                    datasource.setCurrentRecord({
                        "record" : locateCurrRecord
                    });
                }
            }

            ruleContext.fireRuleCallback();
            ruleContext.fireRouteCallback();
            // 关闭域
            scopeManager.closeScope();
        }
        var tainFunc = ruleContext.genAsynCallback(handleEvent);
        setTimeout(tainFunc, 10);

        // if(widgetId instanceof Array){
        // for(var _a = 0;_a<widgetId.length;_a++){
        // var type = widgetContext.getType(widgetId[_a]);
        // if (locateCurrRecord) {
        // if ("JGBizCodeTreeGrid" == type || "JGBizCodeTreeView" ==
        // type || "JGDataGrid" == type || "JGTreeGrid" == type ||
        // "JGTreeView" == type) {
        // widgetAction.executeWidgetAction(widgetId[_a],
        // 'locateRecord', locateCurrRecord);
        // }
        // //设置当前实体
        // datasource.setCurrentRecord({
        // "record": locateCurrRecord
        // });
        // }
        // }
        // }else{
        // var type = widgetContext.getType(widgetId);
        // if (locateCurrRecord) {
        // if ("JGBizCodeTreeGrid" == type || "JGBizCodeTreeView" ==
        // type || "JGDataGrid" == type || "JGTreeGrid" == type ||
        // "JGTreeView" == type) {
        // widgetAction.executeWidgetAction(widgetId, 'locateRecord',
        // locateCurrRecord);
        // }
        // //设置当前实体
        // datasource.setCurrentRecord({
        // "record": locateCurrRecord
        // });
        // }
        // }
        // var type = widgetContext.getType(widgetId);
        //
        // if (locateCurrRecord) {
        // if(type instanceof Array){
        // for(var _a = 0;_a<type.length;_a++){
        // var _type = type[_a];
        // if ("JGBizCodeTreeGrid" == _type || "JGBizCodeTreeView" ==
        // _type || "JGDataGrid" == _type || "JGTreeGrid" == _type ||
        // "JGTreeView" == _type) {
        // widgetAction.executeWidgetAction(widgetId, 'locateRecord',
        // locateCurrRecord);
        // }
        //
        // //设置当前实体
        // datasource.setCurrentRecord({
        // "record": locateCurrRecord
        // });
        // }
        // }else{
        // if ("JGBizCodeTreeGrid" == type || "JGBizCodeTreeView" ==
        // type || "JGDataGrid" == type || "JGTreeGrid" == type ||
        // "JGTreeView" == type) {
        // widgetAction.executeWidgetAction(widgetId, 'locateRecord',
        // locateCurrRecord);
        // }
        //
        // //设置当前实体
        // datasource.setCurrentRecord({
        // "record": locateCurrRecord
        // });
        // }
        //			
        // }

    };

    var _getLocateCurrEntityRecord = function(sourceName, condition,
            isCurrentBegin, searchSort, routeContext) {
        if (!manager.exists({
            "datasourceName" : sourceName
        })) {
            throw new Error("来源实体不存在！sourceName=" + sourceName);
        }

        // 源记录集合
        var datasource = manager.lookup({
            "datasourceName" : sourceName
        });
        var records = datasource.getAllRecords();
        if (records)
            records = records.toArray();
        
        if(records.length == 0){
            return null;
        }
        var allRecords = [];
        var currRecord = datasource.getCurrentRecord();
        var currRecordId = currRecord.getSysId();
        // 从当前行开始
        if (isCurrentBegin) {
            var isCurr = false;
            // 完整列表
            var locaRecordRecords = [];
            //当前行下标
            var curIndex = datasource.getIndexById(currRecordId);
            // 查找顺序正向
            if (searchSort) {
                for (var i = curIndex,l=records.length; i < l; i++) {
                    allRecords.push(records[i]);
                }
                
                // 构造完整的顺序列表
                for (var i = 0; i < curIndex; i++) {
                    locaRecordRecords.push(records[i]);
                }

            } else {
                // 查找顺序反向
                for (var i = curIndex; i >= 0; i--) {
                    allRecords.push(records[i]);
                }
                for (var i = records.length - 1; i >curIndex; i--) {
                    locaRecordRecords.push(records[i]);
                }
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
            log.warn("没有符合条件的记录！sourceName=" + sourceName);
            return null;
        }

        // 如果只有一条记录
        if (allRecords.length == 1) {
            return allRecords[0];
        }

        if (condition == null || stringUtil.trim(condition) === "\"\"") {
            return allRecords[0];
        }

        // 按条件对源记录集合进行过滤
        var locateCurrRecord;

        // 过滤后的记录集合
        //var results = [];
        var currRecordIsMatch = false;
        for (var i = 0; i < allRecords.length; i++) {
            var record = allRecords[i];

            try {
                var context = new ExpressionContext();
                context.setRouteContext(routeContext);
                context.setRecords([ record ]);
                var ret = engine.execute({
                    "expression" : condition,
                    "context" : context
                });
                if (typeof ret != "boolean") {
                    throw new Error("条件必须返回布尔类型");
                }
                // 条件满足
                if (ret == true) {
                    if(isCurrentBegin){//从当前行开始查找
                        if(record.getSysId()!=currRecordId){//须剔除当前行
                            return record;
                        }
                    }else{
                        return record;
                    }
                }
            } catch (e) {
                var message = "表达式执行错误！condition=" + condition
                        + "错误信息：" + e.message;
                log.error(message);
                throw new Error("实体过滤条件不正确！" + message);
            }
        }
        //没有匹配记录时，从当前行开始查找方式返回当前行，否则返回第一条记录
        return isCurrentBegin ? currRecord:records[0];
    };

    exports.main = main;

export{    main}