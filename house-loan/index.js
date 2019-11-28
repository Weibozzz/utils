// [style]: 1 代表等额本金 0 代表等额本息
// [tabValue]: 1 代表等额本金 0 代表等额本息
// [months]: 贷款月数
// [rate]: 贷款利率
// [total]: 贷款金额（万）

/**
 * 贷款详情
 * 入参例子: {"months":"48","rate":"3.25","style":"1","total":"3"}
 * 混合贷款入参例子: {"businessLoan":"{\"total\":\"1\",\"rate\":4.9,\"months\":12}","foundLoan":"{\"total\":\"1\",\"rate\":3.25,\"months\":12}","mixture":"true","style":"0"}
 * @param payload
 * @returns {{'0': (*|*), '1': (*|*)}}
 */
export function loan (payload = {}) {
  if (payload.mixture) {
    const foundLoan = JSON.parse(payload.foundLoan); // 给公积金贷款
    const businessLoan = JSON.parse(payload.businessLoan); // 商业贷款
    const fn = compose(
      mixture,
      toFixed
    );
    return {
      0: fn(
        loan0(foundLoan),
        loan0(businessLoan)
      ),
      1: fn(
        loan1(foundLoan),
        loan1(businessLoan)
      ),
    };
  }
  return {
    0: compose(loan0, toFixed)(payload), // 等额本息
    1: compose(loan1, toFixed)(payload), // 等额本金
  };
}
/**
 * 贷款每一期详情
 * 入参例子: {"options":"{\"months\":\"48\",\"rate\":\"3.25\",\"style\":\"1\",\"total\":\"3\"}","tabValue":"1"}
 * 混合贷款入参例子: {"options":"{\"businessLoan\":\"{\\\"total\\\":\\\"1\\\",\\\"rate\\\":4.9,\\\"months\\\":12}\",\"foundLoan\":\"{\\\"total\\\":\\\"1\\\",\\\"rate\\\":3.25,\\\"months\\\":12}\",\"mixture\":\"true\",\"style\":\"0\"}","tabValue":"0"}
 * @param payload
 * @returns {any[]}
 */
export function loanDetail (payload = {}) {
  let { tabValue, options } = payload;
  options = JSON.parse(options);
  if (options.mixture) {
    const foundLoan = JSON.parse(options.foundLoan); // 给公积金贷款
    const businessLoan = JSON.parse(options.businessLoan); // 商业贷款
    const fn = compose(
      loanDetailMixture,
      loanDetailToFixed
    );
    const result = {
      0: fn(
        loan0Detail(foundLoan),
        loan0Detail(businessLoan)
      ),
      1: fn(
        loan1Detail(foundLoan),
        loan1Detail(businessLoan)
      ),
    };
    return transArr(result[tabValue]);
  }
  const result = {
    0: compose(loan0Detail, loanDetailToFixed)(options),
    1: compose(loan1Detail, loanDetailToFixed)(options),
  };
  return transArr(result[tabValue]);
}
// 贷款明细混合贷款累加
function loanDetailMixture (foundLoanArr, businessLoan) {
  return foundLoanArr.map((item, index) => {
    return {
      ...mixture(item, businessLoan[index]),
      month: item.month,
    };
  });
}
// 保留两位并千分化
function floorAndThousand (num) {
  return compose(floor, thousandSplit)(num);
}
// 贷款明细保留两位
function loanDetailToFixed (arr = []) {
  return arr.map(item => ({
    ...item,
    interest: floorAndThousand(item.interest),
    capital: floorAndThousand(item.capital),
    surplus: floorAndThousand(item.surplus),
    repayment: floorAndThousand(item.repayment),
  }));
}
// 混合贷款
function mixture (foundLoan, businessLoan) {
  const notMixtureKey = ['stage', 'month'];
  return Object.keys(foundLoan)
    .reduce((total, item) => {
      if (notMixtureKey.includes(item)) {
        total[item] = foundLoan[item] || businessLoan[item];
      } else {
        total[item] = foundLoan[item] + businessLoan[item];
      }
      return total;
    }, {});
}
// 千分符号
function thousandSplit (num) {
  return String(num)
    .replace(/(?=\B(?:\d{3})+\b)(\d{3}(\.\d+$)?)/g, ',$1');
}
// 保留两位数字
function toFixed (result) {
  result.loanTotal = floorAndThousand((result.loanTotal / 10000));
  result.monthPaymonent = floorAndThousand((result.monthPaymonent));
  result.repaymentTotal = floorAndThousand((result.repaymentTotal / 10000));
  result.interestTotal = floorAndThousand((result.interestTotal / 10000));
  return result;
}
// 保留两位数字向下取整
function floor (num) {
  return (Math.floor(num * 100) / 100).toFixed(2);
}
// 等额本息 〔贷款本金×月利率×(1+月利率)^还款月数〕÷〔(1+月利率)^还款月数-1〕
function loan0 (payload = {}) {
  const { total, rate, months } = payload;
  const loanTotal = total * 10000;
  const monthRate = rate / 100 / 12;
  let result = {};
  // 贷款总额
  result.loanTotal = loanTotal;
  // 每月月供
  result.monthPaymonent = loanTotal * monthRate * (1 + monthRate) ** months / ((1 + monthRate) ** months - 1);
  // 还款总额
  result.repaymentTotal = result.monthPaymonent * months;
  // 支付利息
  result.interestTotal = result.repaymentTotal - result.loanTotal;
  return result;
}
// 等额本金 每月还款金额= (贷款本金÷ 还款月数)+(本金—已归还本金累计额)×每月利率
function loan1 (payload = {}) {
  const { total, rate, months } = payload;
  const loanTotal = total * 10000;
  const monthRate = rate / 100 / 12;
  // 等额本金还款总额
  function repaymentTotal () {
    const month = (loanTotal / months);
    let total = 0;
    for (let i = 0; i < months; i++) {
      total += (loanTotal / months) + (loanTotal - month * i) * monthRate;
    }
    return total;
  }
  let result = {};
  // 贷款总额
  result.loanTotal = loanTotal;
  // 首月还款
  result.monthPaymonent = (loanTotal / months) + (loanTotal) * monthRate;
  // 还款总额
  result.repaymentTotal = repaymentTotal();
  // 支付利息
  result.interestTotal = result.repaymentTotal - result.loanTotal;
  return result;
}
// 等额本息明细
function loan0Detail (payload = {}) {
  const curLoan = loan0(payload).monthPaymonent;
  const { total, rate, months } = payload;
  const monthRate = rate / 100 / 12;
  const loanTotal = total * 10000;
  let nowMonth = 1; // 第一期
  let stage = 1; // 第一期
  const common = {
    repayment: curLoan,
  };
  const capital = curLoan - loanTotal * monthRate;
  let result = [
    {
      interest: loanTotal * monthRate,
      capital,
      stage,
      month: nowMonth,
      surplus: loanTotal - capital,
      ...common,
    },
  ];
  ++nowMonth;
  ++stage;
  for (let i = 1; i < months; i++) {
    const interest = (loanTotal - (totalArr(result))) * monthRate;
    const capital = curLoan - ((loanTotal - (totalArr(result))) * monthRate);
    const surplus = loanTotal - totalArr(result) - capital;
    result.push({
      interest,
      capital,
      stage,
      month: nowMonth === 13 ? nowMonth = 1 : nowMonth,
      surplus,
      ...common,
    });
    nowMonth++;
    stage++;
  }
  return result;
}
// 等额本息明细相加数组结果
function totalArr (arr) {
  return arr.reduce((total, item) => {
    total += item.capital;
    return total;
  }, 0);
}

// 等额本金明细
function loan1Detail (payload = {}) {
  let nowMonth = 1; // 第一期
  let stage = 1; // 第一期
  const { total, rate, months } = payload;
  const loanTotal = total * 10000;
  const monthRate = rate / 100 / 12;
  let result = [];
  const month = (loanTotal / months);
  for (let i = 0; i < months; i++) {
    // 本期利息
    const curInterest = (loanTotal - month * i) * monthRate;
    // 本期本金
    const curCapital = loanTotal / months;
    // 本期还款
    const curLoan = curCapital + curInterest;
    result.push({
      stage: stage,
      interest: curInterest,
      repayment: curLoan,
      capital: curCapital,
      surplus: loanTotal - curCapital * (i + 1),
      month: nowMonth === 13 ? nowMonth = 1 : nowMonth,
    });
    nowMonth++;
    stage++;
  }

  return result;
}
// 数组变为对象
function transArr (arr = []) {
  let yearObj = {};
  // let nowYear = new Date().getFullYear(); // 当前年
  let nowYear = 1; // 当前年
  yearObj[nowYear] = [];
  arr.forEach((item, index) => {
    if (item.month === 1 && index !== 0) {
      ++nowYear;
      yearObj[nowYear] = [];
    }
    yearObj[nowYear].push(item);
  });
  return Object.keys(yearObj).map(yearKey => {
    return {
      year: yearKey,
      data: yearObj[yearKey],
    };
  });
}
// 整合函数
function compose (...funcs) {
  if (funcs.length === 0) {
    return args => args;
  }
  if (funcs.length === 1) {
    return funcs[0];
  }
  return funcs.reduce((a, b) => (...args) => b(a(...args)));
}
