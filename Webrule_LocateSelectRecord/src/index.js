/**
 * ============记录定位规则 规则说明： 1、规则只影响条件为true的记录；条件为true的记录视情况设置为选中、或者取消选中；
 * 2、条件为false的记录状态不变； 3、树的子节点不会被级联设置； 4、如果条件未设置（为空），则意味着针对所有记录；
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

	exports.initModule = function(sBox) {
		log = sBox.getService("vjs.framework.extension.util.log");
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
		manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		windowVMManager = sBox.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
	}

	var main = function(ruleContext) {
		var inParams = jsonUtil.json2obj(ruleContext.getRuleCfg().inParams);
		// 源实体
		var sourceName = inParams.sourceName;
		// 源实体过滤条件
		var condition = inParams.condition;
		// 是否需要选中
		var isSelect = inParams.isSelect;
		// 取下一条实体记录
		var locateAllRecord = _getAllLocateEntityRecord(sourceName, condition, ruleContext.getRouteContext());
		
		if (locateAllRecord.length > 0) {
			var datasource = manager.lookup({
				"datasourceName": sourceName
			});
			if (datasource.isMultipleSelect()) {
				datasource.selectRecords({
					"records": locateAllRecord,
					"isSelect": isSelect
				});
			} else {
				if (locateAllRecord.length >= 2) {
					var widgetIds = windowVMManager.getWidgetCodesByDatasourceName({
						"datasourceName": sourceName
					});
					for(var i=0;i<widgetIds.length;i++){
						var widgetId = widgetIds[i];
						var type = widgetContext.getType(widgetId);
						if ("JGBizCodeTreeGrid" == type || "JGBizCodeTreeView" == type || "JGDataGrid" == type || "JGTreeGrid" == type || "JGTreeView" == type) {
							widgetAction.executeWidgetAction(widgetId, 'locateRecord', locateAllRecord[locateAllRecord.length - 1]);
						}
					}
					//设置当前实体
					datasource.setCurrentRecord({
						"record": locateAllRecord[locateAllRecord.length - 1]
					});
				} else {
					datasource.setCurrentRecord({
						"record": locateAllRecord[0]
					});
				}

			}
		}
//		
//		var widgetIds = windowVMManager.getWidgetCodesByDatasourceName({
//			"datasourceName": sourceName
//		});
//		for(var i=0;i<widgetIds.length;i++){
//			var widgetId = widgetIds[i];
//			var type = widgetContext.getType(widgetId);
//
//			if ("JGBizCodeTreeGrid" == type || "JGBizCodeTreeView" == type || "JGDataGrid" == type || "JGTreeGrid" == type || "JGTreeView" == type) {
//				if (locateAllRecord.length > 0) {
//					var datasource = manager.lookup({
//						"datasourceName": sourceName
//					});
//					if (datasource.isMultipleSelect()) {
//						datasource.selectRecords({
//							"records": locateAllRecord,
//							"isSelect": isSelect
//						});
//					} else {
//						if (locateAllRecord.length >= 2) {
//							widgetAction.executeWidgetAction(widgetId, 'locateRecord', locateAllRecord[locateAllRecord.length - 1]);
//							//设置当前实体
//							datasource.setCurrentRecord({
//								"record": locateAllRecord[locateAllRecord.length - 1]
//							});
//						} else {
//							datasource.setCurrentRecord({
//								"record": locateAllRecord[0]
//							});
//						}
//
//					}
//				}
//			}
//		}
		
	};

	var _getAllLocateEntityRecord = function(sourceName, condition, routeContext) {
		if (!manager.exists({
				"datasourceName": sourceName
			})) {
			throw new Error("来源实体不存在！sourceName=" + sourceName);
		}

		// 源记录集合
		var datasource = manager.lookup({
			"datasourceName": sourceName
		});
		var records = datasource.getAllRecords();
		if(records)
			records = records.toArray();

		if (condition == null || stringUtil.trim(condition) === '') {
			return records;
		}

		// 过滤后的记录集合
		var results = [];
		for (var i = 0; i < records.length; i++) {
			var record = records[i];
			try {
				var context = new ExpressionContext();
				context.setRouteContext(routeContext);
				context.setRecords([record]);
				var ret = engine.execute({
					"expression": condition,
					"context": context
				});
				if (typeof ret != "boolean") {
					throw new Error("条件必须返回布尔类型");
				}
				// 条件满足
				if (ret == true) {
					results.push(record);
				}
			} catch (e) {
				var message = "表达式执行错误！condition=" + condition + "错误信息：" + e.message;
				log.error(message);
				throw new Error("实体过滤条件不正确！" + message);
			}
		}
		return results;
	};

	exports.main = main;

export{    main}