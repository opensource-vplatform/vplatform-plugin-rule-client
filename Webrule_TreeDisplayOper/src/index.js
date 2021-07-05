/**
 * weicd 2011-11-26
 * 树控件显示操作
 * 格式： {"dataSourceID": "", "dataSourceName": "",  "operType": "specUnFold", "unFoldCount": 3,"treeStruct": [{}]}
 *
 */
vds.import("vds.tree,*","vds.exception.*","vds.widget.*","vds.expression.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			if (!inParamsObj) { //建议兼容
				inParamsObj = "";
			}
			var operType = inParamsObj["operType"];
			var widgetId = inParamsObj["widgetId"];
			// var dataSourceName = windowVmManager.getDatasourceNamesByWidgetCode({
			// 	"widgetCode": widgetId
			// });
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
					if (typeof (depth) != "number") {
						depth = vds.expression.execute(depth, {
							"ruleContext": ruleContext
						});
					}
					expandTree(widgetId, depth);
					break;
				default:
					throw vds.exception.newConfigException("不存在[" + type + "]参数类型，请检查！");
			}
			//TODO
			// ruleContext.setRuleStatus(true);
			// ruleContext.fireRuleCallback();
			// ruleContext.fireRouteCallback();
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}

var getTree = function(widgetId){//改在TreeViewUtil的getTree
	var dataSourceNames = vds.widget.getDatasourceCodes(widgetId);
	var treeStruct = getTreeStruct(widgetId);
	return vds.ds.lookup(dataSourceNames[0],treeStruct);
}
var getTreeStruct = function(widgetId) {
	var treeStruct = {};
	treeStruct["isLeafField"] = getIsLeafRefField(widgetId);
	treeStruct["orderField"] = getOrderNoRefField(widgetId);
	treeStruct["pidField"] = getParentIdRefField(widgetId);
	treeStruct["treeCodeField"] = getInnerCodeRefField(widgetId);
	return treeStruct;
};

// var treeViewUtil, dataAdapter;
// exports.initModule = function (sb) {
// 	treeViewUtil = sb.getService("vjs.framework.extension.platform.services.domain.tree.TreeViewUtil");
// 	dataAdapter = sb.getService("vjs.framework.extension.platform.services.viewmodel.dataadapter.DataAdapter");
// }

/**
 * 折叠当前记录
 * @param {Object} widgetId 控件ID
 * @param {Object} currRecord 折叠的记录行
 */
var collapseNode = function (widgetId, currRecord) {
	if (currRecord) {
		vds.widget.execute(widgetId, "collapseNode", [currRecord.getSysId()]);
	}
};

/**
 * 展开当前记录
 * @param {Object} currRecord 展开的记录行
 */
var expandNode = function (widgetId, node) {
	var unloadNodes = _get_UnLoadSubTreeNodes_In_Node(widgetId, node);
	if (unloadNodes && unloadNodes.length > 0) {
		_get_subTreeNodes_FromDB(widgetId, unloadNodes, true, false);
	}
	vds.widget.execute(widgetId, "expandNode", [node.getSysId()]);
};

/**
 * 展开树的层级
 */
var expandTree = function (widgetId, depth) {
	var loadDepth = 0;
	try {
		var tree = treeViewUtil.getTree(widgetId); //???
		var accessor = tree.getDataAccessor(); //???
		if (accessor) {
			loadDepth = accessor.command.config.depth; //???
		}
		if (!loadDepth) { //如果上一次加载为全部加载，则直接嗲用UI的全部展开接口
			if (depth == 0) {
				vds.widget.execute(widgetId, "expandAll");
			} else {
				vds.widget.execute(widgetId, "expandTreeByDepth", [depth]);
			}
		} else {
			if (loadDepth >= depth) {
				vds.widget.execute(widgetId, "expandTreeByDepth", [depth]);
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
				vds.widget.execute(widgetId, "expandTreeByDepth", [depth]);
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
var _get_subTreeNodes_FromDB = function (widgetId, nodes, isCallObserver, isRefleshConditon) {
	try {
		var tree = treeViewUtil.getTree(widgetId); //???
		var accessor = tree.getDataAccessor(); //???
		if (!accessor) return;
		accessor = treeViewUtil.genLoadSubTreeAccerror({ //???
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
var _get_UnLoadSubTreeNodes_In_Node = function (widgetId, node) {
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
				children.iterate(function (child, i) {
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
var getUnLoadNodesMap = function (widgetId, depth) {
	var unLoadRecordsMap = null;
	//遍历树形
	var tree = treeViewUtil.getTree(widgetId);
	var roots = tree.getRoots();
	var defDepth = 1;
	roots.iterate(function (node, i) {
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
				children.iterate(function (child, i) {
					_get_UnLoadNode_needLoad_depth(child, currDepth + 1);
				});
			}
		}
	};
};
export {
	main
}