CREATE OR REPLACE TABLE RSNMST (
--  SQL150B   10   REUSEDLT(*NO) in table RSNMST in PAYROLL1 ignored.
        ACREC CHAR(1) CCSID 37 NOT NULL DEFAULT '' ,
        RSCDE CHAR(8) CCSID 37 NOT NULL DEFAULT '' ,
        RSDSC CHAR(50) CCSID 37 NOT NULL DEFAULT '' ,
        RSHRC DECIMAL(7, 1) NOT NULL DEFAULT 0 ,
        RSHRY DECIMAL(9, 1) NOT NULL DEFAULT 0 ,
        RSHRP DECIMAL(9, 1) NOT NULL DEFAULT 0 ,
        PRIMARY KEY( RSCDE ) )

        RCDFMT RCRSN      ;

LABEL ON COLUMN RSNMST
( RSCDE IS 'REASON              CODE' ,
        RSDSC IS 'REASON CODE         DESCRIPTION' ,
        RSHRC IS 'RSN CDE HRS         CUR MTH' ,
        RSHRY IS 'RSN CDE             HRS YTD' ,
        RSHRP IS 'RSN CDE HRS         PRIOR YR' ) ;

LABEL ON COLUMN RSNMST
( ACREC TEXT IS 'ACTIVE RECORD CODE' ,
        RSCDE TEXT IS 'REASON CODE' ,
        RSDSC TEXT IS 'REASON CODE DESCRIPTION' ,
        RSHRC TEXT IS 'REASON CODE HRS CURR MONTH' ,
        RSHRY TEXT IS 'REASON CODE HRS YEAR TO DATE' ,
        RSHRP TEXT IS 'REASON CODE HOURS PRIOR YEAR' ) ;

GRANT DELETE , INSERT , SELECT , UPDATE
ON RSNMST TO PUBLIC ;

-- GRANT ALTER , DELETE , INDEX , INSERT , REFERENCES , SELECT , UPDATE
-- ON RSNMST TO WDSCTEST WITH GRANT OPTION ;

