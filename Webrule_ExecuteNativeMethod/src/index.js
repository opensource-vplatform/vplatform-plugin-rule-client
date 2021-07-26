/**
 *  执行开发系统方法
 *  2、执行开发系统方法规则实现
 *  （1）处理规则的入参
 *       （a）获取规则配置ruleCfgValue，将其转化为json对象
 *       （b）获取参数配置invokeParams
 *       （c）获取返回值信息
 *       （d）获取排序，过滤条件等信息
 *    （2）获取服务调用开发系统原生方法，并得到开发系统那边的返回值
 *    （3）将返回值转换成json对象，因为它是字符串
 *    （4）调用C#方法的具体实现
 *         （a）用返回的值，拼装源实体记录集合
 *         （b）将源实体记录集合赋值到目标实体上
 *  @author dengb
 */

var Record;
var nativeMethodAccessorService;

exports.initModule = function (sBox) {
	Record = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.Record");
	nativeMethodAccessorService = sBox.getService("vjs.framework.extension.platform.services.operation.local.NativeMethodAccessor", { 'type': "dotNet" });
}

vds.import("vds.ds.*", "vds.object.*");

//规则主入口(必须有)
var main = function (ruleContext) {
	//处理规则的入参
	var inParamsObj = ruleContext.getVplatformInput();
	var invokeTarget = inParamsObj["invokeTarget"];
	var invokeParams = inParamsObj["invokeParams"];
	var returnMapping = inParamsObj["returnMapping"];
	var filter = inParamsObj["filterCondition"];
	var orderBy = inParamsObj["orderBy"];
	//获取invokeTarget属性
	var methodName = invokeTarget["methodCode"];
	//获取服务调用原生党法
	var config = {};
	var routeContext = ruleContext.getRouteContext();
	var result = nativeMethodAccessorService.invoke("invokeNativeMethod", methodName, invokeParams, config, routeContext);
	var resultFromExeRuleSet = vds.object.stringify(result);
	if (returnMapping && returnMapping.length > 0) {
		for (var i = 0; i < returnMapping.length; i++) {
			var mapping = returnMapping[i];
			var dest = mapping["dest"];      //目标名称
			if (!dest) {
				throw Error("[ExecuteNativeMethod.main]执行原生方法调用规则出错：返回值设置目标不能为空！");
			}
			var destType = mapping["destType"];    //目标类型（entity：实体）
			//	var src = mapping["src"];        //来源(returnValu:返回值，expression:表达式)
			var srcType = mapping["srcType"];//来源(当目标类型是实体时，返回实体存在此处)
			var destFieldMapping = mapping["destFieldMapping"];
			var updateDestEntityMethod = mapping["updateDestEntityMethod"];
			var isCleanDestEntityData = mapping["isCleanDestEntityData"];
			if (!destFieldMapping || !(destFieldMapping instanceof Array) || destFieldMapping.length <= 0) {
				throw new Error("没有配置任何返回字段映射信息");
			}
			if (updateDestEntityMethod == null) {
				updateDestEntityMethod = "insertOrUpdateBySameId";
			}
			var srcEntityName = "srcDB";    //源实体名称：活动集内的
			var destEntityName = dest;  //目标实体名称：窗体内的
			//用c#返回的json对象拼装源实体记录集合
			var srcRecords = [];
			for (var i = 0; i < resultFromExeRuleSet.length; i++) {
				srcRecords[i] = new Record(null, resultFromExeRuleSet[i]);
			}
			// 插入数据到界面实体
			// 本规则只操作界面实体，所以第二个参数写死为entity
			vds.ds.merge(destEntityName, "entity", srcRecords, destFieldMapping, updateDestEntityMethod, isCleanDestEntityData, ruleContext);
		}
	}
};

export { main }