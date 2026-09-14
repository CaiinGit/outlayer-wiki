(function(root){
 'use strict';
 const year=value=>new Intl.NumberFormat('fr-FR',{useGrouping:true,maximumFractionDigits:0}).format(value).replace('-', '−');
 const date=row=>row.date_label || (row.start_year===null?'Date non précisée':row.end_year===null?'An '+year(row.start_year):year(row.start_year)+' à '+year(row.end_year));
 root.Timeline={year,date};
})(globalThis);
