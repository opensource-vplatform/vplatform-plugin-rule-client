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

	var jsonUtil,
		sandBox,
		Record,
		dbService;
	exports.initModule = function(sBox){
		 jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		 sandBox = sBox;
		 Record = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.Record");
		 //datasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		 dbService = sBox.getService("vjs.framework.extension.platform.services.view.logic.datasource.DatasourceUtil");
	}
	//规则主入口(必须有)
	var main = function (ruleContext) {
		//处理规则的入参
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		var invokeTarget=inParamsObj["invokeTarget"];
		
		
		var invokeParams=inParamsObj["invokeParams"];
		var returnMapping = inParamsObj["returnMapping"];
		var filter = inParamsObj["filterCondition"];
		var orderBy = inParamsObj["orderBy"];
		//获取invokeTarget属性
		var methodName = invokeTarget["methodCode"];
	   //获取服务调用原生党法
		var nativeMethodAccessorService = sandBox.getService("vjs.framework.extension.platform.services.operation.local.NativeMethodAccessor",{'type':"dotNet"});
		var config = {};
		var routeContext = ruleContext.getRouteContext();
		var result = nativeMethodAccessorService.invoke("invokeNativeMethod",methodName,invokeParams,config,routeContext); 
		var resultFromExeRuleSet = jsonUtil.json2obj(result);
		if(returnMapping && returnMapping.length > 0 ){
			for ( var i = 0; i < returnMapping.length; i++) {
				var mapping = returnMapping[i];
				var dest = mapping["dest"];      //目标名称
				if(!dest){
					throw Error("[ExecuteNativeMethod.main]执行原生方法调用规则出错：返回值设置目标不能为空！");
				}
				var destType = mapping["destType"];    //目标类型（entity：实体）
			//	var src = mapping["src"];        //来源(returnValu:返回值，expression:表达式)
				var srcType = mapping["srcType"];//来源(当目标类型是实体时，返回实体存在此处)
				var destFieldMapping = mapping["destFieldMapping"];
				var updateDestEntityMethod = mapping["updateDestEntityMethod"];
				var isCleanDestEntityData = mapping["isCleanDestEntityData"];
				if (!destFieldMapping || !(destFieldMapping instanceof Array) || destFieldMapping.length <= 0){
					 throw new Error("没有配置任何返回字段映射信息");
				}
			    if(updateDestEntityMethod==null){
			    	updateDestEntityMethod="insertOrUpdateBySameId";
			    }
			    var srcEntityName = "srcDB";    //源实体名称：活动集内的
			    var destEntityName = dest;  //目标实体名称：窗体内的
			    //用c#返回的json对象拼装源实体记录集合
			    var srcRecords = [];
			   // var dataSource = datasourceManager.lookup({"datasourceName":srcEntityName});
			    for(var i=0;i<resultFromExeRuleSet.length;i++){
					//srcRecords[i] = Record.create(srcEntityName,resultFromExeRuleSet[i],null);
			    	
			    	srcRecords[i] = new Record(null,resultFromExeRuleSet[i]);
				}
			    // 插入数据到界面实体
			    // dbUtil.insertOrUpdateRecords2Entity(destEntityName,srcRecords,isCleanDestEntityData,destFieldMapping,updateDestEntityMethod);
			    // 2015-05-08 liangchaohui：修改insertOrUpdateRecords2Entity，操作类型为更新时，如果目标实体没有匹配id的记录，则不做任何操作，原来没匹配id时会新增记录
			    // 本规则只操作界面实体，所以第二个参数写死为entity
			    dbService.insertOrUpdateRecords2Entity(destEntityName, "entity", srcRecords, destFieldMapping, updateDestEntityMethod, isCleanDestEntityData, ruleContext);
				
			}
		}
		
	};
	
	
	exports.main = main;

export{    main}