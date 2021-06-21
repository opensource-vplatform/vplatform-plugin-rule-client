/**
 * 删除列表中的选择行
 */

	var jsonUtil;
	var manager;
	var datasourcePuller;
	var ExpressionContext;
	var engine;

	exports.initModule = function(sb) {
		jsonUtil = sb.getService("vjs.framework.extension.util.JsonUtil");
		manager = sb.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		datasourcePuller = sb.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePuller");
		DBFactory = sb.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
		ExpressionContext = sb.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sb.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	}

	var main = function(ruleContext) {
		var deleteParams = jsonUtil.json2obj(ruleContext.getRuleCfg()["inParams"]);
		var dsName = deleteParams["TableName"];
		var condition = deleteParams["Condition"];
		//删除方式，0表示删除当前选中记录,1表示删除指定条件记录(条件为空时删除所有的)，如果删除方式为空,默认为删除当前选中记录
		var deleteType = deleteParams["deleteType"];
		var EntityType = deleteParams["EntityType"]; 
		var treeStruct = null;
		var context = new ExpressionContext();
		var datasource = getDataSource(dsName,ruleContext,EntityType);//根据类型获取数据源
		var removeIds = getRemoveIds(datasource, condition, deleteType, ruleContext.getRouteContext());
		if (undefined != removeIds && null != removeIds && removeIds.length > 0) {
			// 删除数据
			//_removeRecords(dsName, removeIds);
			datasource.removeRecordByIds({
				"ids": removeIds
			});
		}
	};

	/**
	 * 获取主表删除的id
	 * @param dsName 待删除表数据源名称
	 * @param condition 条件
	 * @param deleteType 删除方式
	 */
	var getRemoveIds = function(ds, condition, deleteType, routeContext) {
		//删除方式，0表示删除当前选中记录,1表示删除指定条件记录(条件为空时删除所有的),如果删除方式为空，默认为删除当前选中记录
		if (deleteType == null)
			deleteType = "0";

		var removeIds = [];
		var datasource = ds;
		//0表示删除当前选中记录
		if (deleteType == "0" || deleteType == 0) {
			var retRecords = datasource.getSelectedRecords().toArray();

			// 取选中行
			// 遍历数据取主键id
			if (undefined != retRecords && null != retRecords && retRecords.length > 0) {
				for (var rowsIndex = 0; rowsIndex < retRecords.length; rowsIndex++) {
					removeIds.push(retRecords[rowsIndex].getSysId());
				}
			}
		} else if (deleteType == "1" || deleteType == 1) {
			//1表示删除指定条件记录
			var records = datasource.getAllRecords().toArray();
			if (undefined != records && null != records && records.length > 0) {
				for (var index = 0; index < records.length; index++) {
					var record = records[index];
					var id = record.getSysId();
					//条件为空时删除所有的
					if (condition == null || condition.length == 0) {
						removeIds.push(id);
						continue;
					}

					var context = new ExpressionContext();
					context.setRouteContext(routeContext);
					context.setRecords([record]);
					var ret = engine.execute({
						"expression": condition,
						"context": context
					});
					if (typeof ret != "boolean") {
						throw "条件必须返回布尔类型，请检查";
					}
					if (ret == true) {
						removeIds.push(id);
					}
				}
			}
		}

		return removeIds;
	};
	
	/**
	 * 扩展viewModel.removeByDS方法，特殊的控件类型，特殊处理
	 * @param dsName 数据源
	 * @param removeIds 删除的记录ID
	 */
	var removeRecordsByWidgetType = function(dsName, removeIds) {
		var datasource = manager.lookup({
			"datasourceName": dsName
		});
		datasource.removeRecordByIds({
			"ids": removeIds
		});
	};

	/**
	 * 递归需要删除的数据源及其下级数据源，从页面上搜集需要联动删除的记录
	 * @param dsName 数据源
	 * @param ids 查询的ids
	 */
	var _removeRecords = function(dsName, ids) {
		if (!ids || ids.length <= 0) {
			return;
		}
		removeRecordsByWidgetType(dsName, ids);
	};
	/**
	 * 获取数据源
	 * @param ds 数据源名称
	 * @param ruleContext 规则上下文
	 * @param EntityType 实体类型
	 */
	var getDataSource = function(ds,ruleContext,EntityType){//获取数据源
		var dsName = ds;
		var datasource = null;
		if(undefined==EntityType||EntityType=="window"){
			datasource = manager.lookup({
				"datasourceName": dsName
			});
		}else{
			switch(EntityType){
				case "ruleSetInput":
					dsName = "BR_IN_PARENT."+dsName;
					 break;
				case "ruleSetVar":
					dsName = "BR_VAR_PARENT."+dsName;
					break;
				case "ruleSetOutput":
					dsName = "BR_OUT_PARENT."+dsName;
					break;
			}
			var context = new ExpressionContext();
			context.setRouteContext(ruleContext.getRouteContext());
			datasource = engine.execute({
				"expression": dsName,
				"context": context
			});
		}
		if(!datasource) throw new Error("规则[DeleteListSelectRow]：找不到参数中的实体！"+dsName);
		return datasource;
	}

	exports.main = main;
	//提供方便单元测试，请勿在外部调用
	exports.getRemoveIds = getRemoveIds;
	exports._removeRecords = _removeRecords;

export{    main}