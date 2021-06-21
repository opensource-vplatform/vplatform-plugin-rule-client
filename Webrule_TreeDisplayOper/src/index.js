/**
 * weicd 2011-11-26
 * 树控件显示操作
 * 格式： {"dataSourceID": "", "dataSourceName": "",  "operType": "specUnFold", "unFoldCount": 3,"treeStruct": [{}]}
 *
 */

	var jsonUtil,  windowVmManager, widgetAction, treeViewUtil, dataAdapter,scopeManager;
	var formulaUtil;
	var ExpressionContext;
	exports.initModule = function(sb) {
		formulaUtil = sb.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		ExpressionContext = sb.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
		jsonUtil = sb.getService("vjs.framework.extension.util.JsonUtil");
		windowVmManager = sb.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
		widgetAction = sb.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		treeViewUtil = sb.getService("vjs.framework.extension.platform.services.domain.tree.TreeViewUtil");
		dataAdapter = sb.getService("vjs.framework.extension.platform.services.viewmodel.dataadapter.DataAdapter");
		scopeManager = sb.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	}
	
	var callback = function(ruleContext){
		var sId = scopeManager.getCurrentScopeId();
		return function(){
			scopeManager.openScope(sId);
			var ruleCfgValue = ruleContext.getRuleCfg();
			var ruleInstId = ruleCfgValue["ruleInstId"];
			var inParams = ruleCfgValue["inParams"];
			var inParamsObj = jsonUtil.json2obj(inParams);
			var operType = inParamsObj["operType"];
			var widgetId = inParamsObj["widgetId"];
			var dataSourceName = windowVmManager.getDatasourceNamesByWidgetCode({
				"widgetCode": widgetId
			});
			try {
				switch (operType) {
					//折叠当前节点
					case "fold":
						var tree = treeViewUtil.getTree(widgetId);
						var currRecord = tree.getCurrentRecord();
						if (currRecord) {
							collapseNode(widgetId, currRecord);
						}
						break;
						//展开当前节点
					case "unFold":
						var tree = treeViewUtil.getTree(widgetId);
						var currRecord = tree.getCurrentRecord();
						if (currRecord) {
							var node = tree.getNodeById(currRecord.getSysId());
							expandNode(widgetId, node);
						}
						break;
						//显示到第几层
					case "specUnFold":
						var depth = inParamsObj["unFoldCount"];
						if(typeof(depth)!="number"){
							var context = new ExpressionContext();
							context.setRouteContext(ruleContext.getRouteContext());
							depth = formulaUtil.execute({
								"expression": depth,
								"context": context
							});
						}	
						expandTree(widgetId, depth);
						break;
					default:
						throw new Error("不存在[" + type + "]参数类型，请检查！");
						break;
				}
			} catch (e) {
				window.console.error(e.message);
			}
			//TODO
			ruleContext.setRuleStatus(true);
			ruleContext.fireRuleCallback();
			ruleContext.fireRouteCallback();
			scopeManager.closeScope();
		}
	};

	var main = function(ruleContext) {
		var  cb = callback(ruleContext);
		//TODO
		setTimeout(cb,20);
		//终止规则链执行
		ruleContext.markRouteExecuteUnAuto();
		
	};

	/**
	 * 折叠当前记录
	 * @param {Object} widgetId 控件ID
	 * @param {Object} currRecord 折叠的记录行
	 */
	var collapseNode = function(widgetId, currRecord) {
		if (currRecord) {
			widgetAction.executeWidgetAction(widgetId, "collapseNode", currRecord.getSysId());
		}
	};

	/**
	 * 展开当前记录
	 * @param {Object} currRecord 展开的记录行
	 */
	var expandNode = function(widgetId, node) {
		var unloadNodes = _get_UnLoadSubTreeNodes_In_Node(widgetId, node);
		if (unloadNodes && unloadNodes.length > 0) {
			_get_subTreeNodes_FromDB(widgetId, unloadNodes, true, false);
		}
		widgetAction.executeWidgetAction(widgetId, "expandNode", node.getSysId());
	};

	/**
	 * 展开树的层级
	 */
	var expandTree = function(widgetId, depth) {
		var loadDepth = 0;
		try {
			var tree = treeViewUtil.getTree(widgetId);
			var accessor = tree.getDataAccessor();
			if (accessor) {
				loadDepth = accessor.command.config.depth;
			}
			if (!loadDepth) { //如果上一次加载为全部加载，则直接嗲用UI的全部展开接口
				if (depth == 0) {
					widgetAction.executeWidgetAction(widgetId, "expandAll");
				} else {
					widgetAction.executeWidgetAction(widgetId, "expandTreeByDepth", depth);
				}
			} else {
				if (loadDepth >= depth) {
					widgetAction.executeWidgetAction(widgetId, "expandTreeByDepth", depth);
				} else {
					var unLoadRecordsMap = getUnLoadNodesMap(widgetId, depth);
					if (unLoadRecordsMap) {
						var unLoadRecords = [];
						for (var key in unLoadRecordsMap) {
							var srcRecords = unLoadRecordsMap[key];
							if (srcRecords) {
								unLoadRecords = unLoadRecords.concat(srcRecords);
							}
						}
						// 获取数据， 但不通知UI更新（不会出现根节点）, 主要是UIhandler不知道要显示的层级， 这里又不想把加载出来的数据再清空
						var datas = _get_subTreeNodes_FromDB(widgetId, unLoadRecords, true, true);
					}
					widgetAction.executeWidgetAction(widgetId, "expandTreeByDepth", depth);
				}
			}
		} catch (e) {
			window.console.error(e.message);
		}
	};

	/**
	 * 从数据库中加载参数节点中的所有子树节点
	 * @param {Object} widgetId
	 * @param {Object} nodes 需要加载的节点集合
	 * @param {Object} isCallObserver 是否需要通知handler更新UI
	 * @param {Object} isRefleshConditon 是否更新加载的条件
	 */
	var _get_subTreeNodes_FromDB = function(widgetId, nodes, isCallObserver, isRefleshConditon) {
		try {
			var tree = treeViewUtil.getTree(widgetId);
			var accessor = tree.getDataAccessor();
			if (!accessor) return;
			accessor = treeViewUtil.genLoadSubTreeAccerror({
				"tree": tree,
				"nodes": nodes
			});
			var queryParam = {
				"dataAccessObjects": [accessor],
				"isAsync": false
			}
			dataAdapter.queryData({
				"config": queryParam,
				"isAppend": true,
				"refreshCondition": false
			});
		} catch (e) {
			window.console.error(e.message);
		}
	};

	/**
	 * 获取某个节点的子树中， 没有加载过的节点
	 */
	var _get_UnLoadSubTreeNodes_In_Node = function(widgetId, node) {
		if (!node)
			return;
		var unLoadNodes = [];
		//var treeViewModel = treeViewUIHelp.getTreeViewModel(widgetId);
		_getUnLoadNodes(node);
		return unLoadNodes;
		/**
		 * 递归获取某个节点的子树中， 没有加载过的节点
		 */
		function _getUnLoadNodes(node) {
			if (node.isLeaf()) {
				return;
			} else {
				var children = node.getChildren();
				if (children.isEmpty()) {
					unLoadNodes.push(node);
				} else {
					children.iterate(function(child, i) {
						_getUnLoadNodes(child);
					});
				}
			}
		}

	};

	/**
	 * 获取需要加载节点的节点Map， 格式[{“需要加载的层级”:[加载的记录数]}]
	 * @param {Object} widgetId
	 * @param {Object} depth 加载的层级
	 * @return unLoadRecordsMap 数据格式：[{需要加载的层级数：[records]}]
	 */
	var getUnLoadNodesMap = function(widgetId, depth) {
		var unLoadRecordsMap = null;
		//遍历树形
		var tree = treeViewUtil.getTree(widgetId);
		var roots = tree.getRoots();
		var defDepth = 1;
		roots.iterate(function(node, i) {
			_get_UnLoadNode_needLoad_depth(node, defDepth);
		});
		return unLoadRecordsMap;

		/**
		 * 获取前端没有加载的节点， 需要从数据库中加载多少级孩子的节点集合
		 * @param {Object} node
		 */
		function _get_UnLoadNode_needLoad_depth(node, currDepth) {
			if (node.isLeaf()) {
				return;
			} else {
				if (currDepth == depth) {
					return;
				}
				var children = node.getChildren();
				if (children.isEmpty()) {
					if (!unLoadRecordsMap) {
						unLoadRecordsMap = {};
					}
					var tierRecordMap = unLoadRecordsMap[depth - currDepth];
					if (tierRecordMap) {
						tierRecordMap.push(node);
					} else {
						unLoadRecordsMap[depth - currDepth] = [node];
					}
				} else {
					children.iterate(function(child, i) {
						_get_UnLoadNode_needLoad_depth(child, currDepth + 1);
					});
				}
			}
		};
	};

	exports.main = main;

export{    main}