/**
 * 导出表格数据
 * shenxiangz
 */

    var mapUtil;
    var dynamicColumnUtil;
    var stringUtil;
    var jsonUtil;
    var formulaUtil;
    var treeViewModel;
    var widgetContext;
    var ExpressionContext;
    var windowVmManager;
    var datasourceManager;
    var scopeManager;
    var widgetAction;
    var widgetProperty;

    exports.initModule = function(sBox) {
        treeViewModel = sBox.getService("vjs.framework.extension.platform.services.domain.tree.TreeViewUtil");
        dynamicColumnUtil = sBox.getService("vjs.framework.extension.platform.services.widget.dynamiccolumn.DynamicColumnUtil");
        mapUtil = sBox.getService("vjs.framework.extension.util.MapUtil");
        stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
        widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
        widgetProperty = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetProperty");
        jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
        formulaUtil = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
        ExpressionContext = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
        windowVmManager = sBox.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
        datasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
        scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
        widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
    }

    var main = function(ruleContext) {
        //当任何一条匹配数据不满足比较条件时，返回false，否则返回true(包括两种情况：不存在匹配数据或所有匹配数据都满足比较条件)；
        var bussinessReturnValue = true;
        var ruleCfg = ruleContext.getRuleCfg();
        var paramsValue = ruleCfg["inParams"];
        var ruleInstId = ruleCfg["ruleInstId"]; //规则ID
        var scope = scopeManager.getWindowScope();
        var moduleId = scope.getWindowCode();
        var params = jsonUtil.json2obj(paramsValue);
        var gridWidgetId = params["gridId"];

        if (!params["gridId"]) {
            gridWidgetId = params["gridDsName"];
        }
        var dsNames = windowVmManager.getDatasourceNamesByWidgetCode({
            "widgetCode": gridWidgetId
        });
        var dataSource = dsNames[0];
        var exportColumns = params["exportColumns"];
        if (gridWidgetId == null || gridWidgetId == "") {
            throw new Error("导出的表格控件不能为空");
        }
        if (dataSource == null || dataSource == "") {
            throw new Error("导出的表格控件数据源不能为空");
        }

        var entity = datasourceManager.lookup({
            "datasourceName": dataSource
        });

        var isFreeDB = false;
        if (exportColumns == null || exportColumns.length == 0) {
            // 处理动态列表，对应实体为游离DB
            var entityFiels = entity ? entity.getMetadata().getFields() : null;
            if (entityFiels && entityFiels.length > 0)
                isFreeDB = true;
            else if (exportColumns == null || exportColumns.length == 0)
                throw new Error("导出的列不能为空");
        }

        var records = entity.getAllRecords().toArray();
        //如果是树表或编码树表，则需要对数据按树结构排序
        var widgetType = widgetContext.getType(gridWidgetId);
        if (records.length > 0 && "JGTreeGrid" == widgetType) {
            var idRecordMap = new mapUtil.Map();
            for (var i = 0; i < records.length; i++) {
                var record = records[i];
                var id = record.getSysId();
                idRecordMap.put(id, record);
            }
            var treeStructData = null;

            //树表的实现方式，父子节点：层级码树表，左右编码：左右树表，业务编码：业务编码树表
            var realizeWay = widgetProperty.get(gridWidgetId, "RealizeWay");
            var pidColumn = widgetProperty.get(gridWidgetId, "PIDColumn");
            var innerCodeColumn = widgetProperty.get(gridWidgetId, "InnerCodeColumn");
            var leftCodeColumn = widgetProperty.get(gridWidgetId, "LeftCodeColumn");
            var rightCodeColumn = widgetProperty.get(gridWidgetId, "RightCodeColumn");
            var orderNoColumn = widgetProperty.get(gridWidgetId, "OrderNoColumn");
            var leafColumn = widgetProperty.get(gridWidgetId, "LeafNode");

            //业务编码字段
            var bizCodeColumn = widgetProperty.get(gridWidgetId, "CodeColumn");
            var bizCodeFormat = widgetProperty.get(gridWidgetId, "CodeFormat");

            //树表
            if ("JGTreeGrid" == widgetType) {
                var treeStructCfg = {
                    tableID: null,
                    tableName: dataSource,
                    type: "1",
                    pidField: pidColumn,
                    treeCodeField: innerCodeColumn,
                    orderField: orderNoColumn,
                    isLeafField: leafColumn
                };
                if (realizeWay == "左右编码") {
                    treeStructCfg = {
                        tableID: null,
                        tableName: dataSource,
                        type: "2",
                        pidField: pidColumn,
                        leftField: leftCodeColumn,
                        rightField: rightCodeColumn
                    };
                }

                treeStructData = treeViewModel.getTreeStructData({
                    "parentId": "-1",
                    "records": records,
                    "treeStruct": treeStructCfg
                });
            }
            records = getSortedTreeRecords(idRecordMap, treeStructData);
        } 

        var resultData = [];
        if (records && records.length > 0) {
            for (var i = 0; i < records.length; i++) {
                var record = records[i];
                resultData.push(record.toMap());
            }            
        }

        var columnDefineObjs = findGridFields(gridWidgetId, dataSource);
        if(records.length > 0 && "JGDataGrid" == widgetType){
        	//处理列表合计
        	var summaryData=widgetAction.executeWidgetAction(gridWidgetId, "getSummaryData");
        	if(summaryData!=null){
        		var lastRowIndex = columnDefineObjs.length - 1;
		        var columnidCodeMap = {};
		        var columns = columnDefineObjs[lastRowIndex];
		        for (var i = 0; i < columns.length; i++) {		        	
            	    var id = columns[i].id;
            	    var code = columns[i].field;
            	    columnidCodeMap[code]=id;
		        }
		        var sumaryRecord={};
		        for(var key in records.get(0).toMap()){
		        	var id=columnidCodeMap[key];
		        	if(id!=undefined){
		        		var recodeValue=summaryData[id];
		        		if(recodeValue!=undefined){
		        			sumaryRecord[key]=recodeValue;
		        			continue;
		        		}
		        	}
					sumaryRecord[key]=null;
				}		        
        		resultData.push(sumaryRecord);
        	}
        	
        }
        var finalExportColumns = filterExportColumns(columnDefineObjs, exportColumns, isFreeDB);

        params.exportColumns = finalExportColumns;
        params.datas = resultData;
        params.dsName = dataSource;
        if (params.exportFileName != null && params.exportFileName != "") {
            var context = new ExpressionContext();
            context.setRouteContext(ruleContext.getRouteContext());
            params.exportFileName = formulaUtil.execute({
                "expression": params.exportFileName,
                "context": context
            });
        }

        var paramObj = params;
        if (paramObj != null) {
            for (var i = 0; i < paramObj.datas.length; i++) {
                if (paramObj.datas[i].children != undefined) {
                    delete paramObj.datas[i].children;
                }
                if (paramObj.datas[i]._parent_isc_Tree_0 != undefined) {
                    delete paramObj.datas[i]._parent_isc_Tree_0;
                }
            }
        }

        var token = {
            data: paramObj
        };
        var tokenJson = jsonUtil.obj2json(token);
        var tokenEncode = encodeURIComponent(tokenJson);

        //因为参数中需要传递大量数据，所以不能用ajax提交，只能使用隐藏form提交来解决
        var url = 'module-operation!executeOperation?moduleId=' + scope.getWindowCode() + '&operation=ExportTableData';

        var iframeId = "file_down_iframe";
        var formId = "iframeDownForm"

        createIFrame(iframeId, "");
        var formObj = createForm(formId, iframeId, url, tokenEncode);
        formObj.submit();

        return true;
    };

    function createForm(formId, iframeId, actionUrl, tokenId) {
        var formObj = document.getElementById(formId);
        if (formObj == null) {
            formObj = document.createElement("form");
            formObj.setAttribute("id", formId);
            formObj.setAttribute("method", "post");
            formObj.setAttribute("target", iframeId);
            formObj.setAttribute("style", "display:none");
            document.body.appendChild(formObj);
        }
        formObj.setAttribute("action", actionUrl);
        formObj.innerHTML = "<input id='tokenId' type='hidden' name='token' value=\"" + tokenId + "\">";
        return formObj;
    }

    function createIFrame(iframeId, url) {
        var iframeObj = document.getElementById(iframeId);
        if (iframeObj == null) {
            iframeObj = document.createElement("iframe");
            iframeObj.setAttribute("id", iframeId);
            iframeObj.setAttribute("style", "display:none");
            document.body.appendChild(iframeObj);
        }
        iframeObj.setAttribute("src", url);
    }

    function setBusinessRuleResult(ruleContext, result) {
        if (ruleContext.setBusinessRuleResult) {
            ruleContext.setBusinessRuleResult({
                isMatchCompare: result
            });
        }
    }

    var getFieldName = function(fieldName) {
        if (fieldName == null)
            throw new Error("字段名不能为空!");
        var pos = fieldName.indexOf(".");
        if (pos > 0) {
            return fieldName.substring(pos + 1);
        }
        return fieldName;
    };

    var getSortedTreeRecords = function(idRecordMap, treeStructDatas) {
        var retSortedTreeDatas = [];
        for (var i = 0; i < treeStructDatas.length; i++) {
            _getSortedTreeRecords(idRecordMap, retSortedTreeDatas, treeStructDatas[i]);
        }
        idRecordMap.clear();
        return retSortedTreeDatas;
    };

    var _getSortedTreeRecords = function(idRecordMap, retSortedRecords, curTreeNode) {
        if (curTreeNode == null)
            return;
        var record = idRecordMap.get(curTreeNode.record.getSysId());
        if (record == null)
            return;
        retSortedRecords.push(record);

        if (curTreeNode.children == null || curTreeNode.children.length == 0)
            return;
        for (var i = 0; i < curTreeNode.children.length; i++) {
            var childNode = curTreeNode.children[i];
            _getSortedTreeRecords(idRecordMap, retSortedRecords, childNode);
        }

    };

    var findGridFields = function(widgetId, dataSourceName) {
        var datasource = datasourceManager.lookup({
            "datasourceName": dataSourceName
        });
        var metadata = datasource.getMetadata();
        var metaFields = metadata.getFields();
        var widget = widgetContext.getAll(widgetId);
        //var rowsFixedCount = widget["RowsFixedCount"];

        var headerSpans = widget.widgetObj._headerSpans;
        var rowsFixedCount = widget.widgetObj._getHeaderRowNum(headerSpans);
        // 是否单行表头
        var isSingleHeadRows = (rowsFixedCount == 1);
        var propertiesList = widgetAction.executeWidgetAction(widgetId, "getFields");
        // 表格列定义列表
        var columns = [];

        // TODO: 新方案处理多行列表头
        var spanMap = widget.widgetObj._widget.spanMap;
        var getSpanName = function(headerIndex, tarColumnName, spansMap, seq) {
            if (!spansMap)
                return;

            if (seq == null)
                seq = 1;

            // 判断当前列是否存在
            var spanObj = spansMap[tarColumnName];

            var getTitle = function(spanObj, seq) {
                if (spanObj) {
                    seq++;

                    var _parentSpan = spanObj["parentSpan"];

                    if (!_parentSpan || seq >= headerIndex) {

                        var columnCfg = {
                            "id": spanObj.liveObject && spanObj.liveObject.ID, // 用于后台判断是否允许合并相同 cell
                            "title": spanObj.title
                        };

                        return columnCfg;
                    } else if (_parentSpan && seq < headerIndex) {
                        return getTitle(_parentSpan, seq);
                    }
                }
            }

            return getTitle(spanObj, seq);
        };

        // 旧版本写死宽度 未知原因 
        var cellWidth = 100;

        var _headRowInfo = [];
        for (var j = 0; j < rowsFixedCount; j++) {
            // 遍历N次，N 为标题行数
            var curHeadRowInfo = [];
            for (var i = 0; i < propertiesList.length; i++) {
                var properties = propertiesList[i];

                if (properties._isRowNumberField)
                    continue;

                // 如果为最后一行，则按照原有数据properties中获取内容
                if (j === rowsFixedCount - 1) {
                    var columnCfg = {
                        "id": properties.columnId,
                        "field": properties.name,
                        "title": properties.title,
                        "width": cellWidth,
                        "isFieldColumn": true,
                        "AllowMerge": properties.AllowMerge , //允许合并
                        "MergeColumnNames": properties.MergeColumnNames//合并条件字段
                    };

                    curHeadRowInfo.push(columnCfg);
                    continue;
                }

                var tarColumnName = properties["name"];
                // 根据 index 获取当前Cell的名字
                var curColName = getSpanName(rowsFixedCount - j, tarColumnName, spanMap);
                curHeadRowInfo.push(curColName);
            }

            _headRowInfo.push(curHeadRowInfo);
        }

        return _headRowInfo;
    }
    
    /**
     * 获取列标题的文字部分
     * */
    var getColumnTitleText = function(title){
    	var result = title;
    	if(title){
    		var dom = $("<div>" + title + "</div>")[0];
    		var text = dom.innerText;
    		var len = dom.children.length;
    		if(len > 0){
    			var childText = dom.children[0].innerText;
    			result = text.substring(childText.length, text.length);
    		}
    	}
    	return result;
    }
    
    var filterExportColumns = function(allColumns, exportColumns, isFreeDB) {
        if ((exportColumns == null || exportColumns.length == 0) && !isFreeDB)
            return null;

        var retColumns = [];
        //allColumns为二维数组，最后一行索引
        var lastRowIndex = allColumns.length - 1;

        var tmpColumnIndexs = [];
        var columns = allColumns[lastRowIndex];
        for (var i = 0; i < columns.length; i++) {
            var curFieldName = columns[i].id;
            if (columns[i].isDynamic) {
                var tmps = curFieldName.split("||");
                curFieldName = tmps[tmps.length - 1];
            }
            var match = false;
            // 处理列表实体为游离DB,导出表中所有字段
            if (isFreeDB)
                match = true
            else {
                for (var j = 0; j < exportColumns.length; j++) {
                    var tmpFieldName = getFieldName(exportColumns[j].fieldName);
                    if (tmpFieldName == curFieldName) {
                        match = true;
                        break;
                    }
                }
            }
            if (match) {
                //复制出导出的列
                for (var m = 0; m < allColumns.length; m++) {
                    var rowColumns = allColumns[m];
                    if (retColumns[m] == null)
                        retColumns[m] = [];
                    var rowColumn = rowColumns[i];
                    if(rowColumn && rowColumn.title){
                    	rowColumn.title = getColumnTitleText(rowColumn.title);
                    }
                    retColumns[m].push(rowColumn);
                }
            }
        }

        return retColumns;
    };

    exports.main = main;

export{    main}