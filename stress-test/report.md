# Doc-Parser Stress Test Report

Generated: 2026-04-08T10:05:13.551Z

## MBL Priority Files

### MBL_003_URS_A01_MBL_4.9-02.A01 Security Matrix.xlsx
- Status: success (5545ms)
- Size: 813KB
- Text length: 170794
- Method: exceljs
- Sheets: 20 | Pages: -
- Warnings: none
- First 300 chars:

```
--- Sheet: Cover ---
		Security Matrix			
			System			
			ID: 	INV-00000011 (mbl.mybluelabel.com)		
			Name: 	MyBlueLabel Quality Management System			
			Version:	5.x.x.		
			Organization:	MyBlueLabel ApS		
Author's Signature:
The signature indicates that this document has been prepared in accordanc
```

### MBL_009_TM_MBL_3.0-04. Traceability Matrix.xlsx
- Status: success (7917ms)
- Size: 980KB
- Text length: 1452998
- Method: exceljs
- Sheets: 71 | Pages: -
- Warnings: none
- First 300 chars:

```
--- Sheet: Cover ---
		Traceability Matrix					
			System				
			ID: 	INV-00000001 (mbl.mybluelabel.com)		
			Name: 	MyBlueLabel Quality Management System		
			Version:	4.x.x 		
			Organization:	MyBlueLabel ApS		
Author's Signature:
The signature indicates that this document has been prepared in acc
```

### SOP_001_TMP_F03_MBL_2.0-F03 - Training Matrix Training Plan.xlsx
- Status: success (361ms)
- Size: 132KB
- Text length: 21030
- Method: exceljs
- Sheets: 9 | Pages: -
- Warnings: none
- First 300 chars:

```
--- Sheet: Cover ---
			MyBlueLabel ApS			
		Training Matrix Form				
		Training Management Procedure				
Author's Signature:
The signature indicates that this document has been prepared in accordance with expectations from the Quality Manual and the Good Documentation Practices has been followed. 	
```

### SOP_003_CMP_MBL_2.1-01. Change and Configuration Management Procedure.docx
- Status: success (761ms)
- Size: 378KB
- Text length: 30113
- Method: mammoth
- Sheets: - | Pages: -
- Warnings: mammoth: An unrecognised element was ignored: v:stroke
- First 300 chars:

```


	MBL Compliance Service ApS





Standard Operating Procedure

Change and Configuration Management





Author's Signature:

The signature indicates that this document has been prepared in accordance with expectations from the Quality Manual and the Good Documentation Practices has been followed. 
```

## Totals

- Attempted: 47
- Success: 47
- Failure: 0
- Timeout: 0
- Non-ASCII docs: 44

## Per-Format Breakdown

| Ext | Count | Success | Rate | Avg ms | MB/s |
|---|---|---|---|---|---|
| .xlsx | 5 | 5 | 100.00% | 3044.80 | 0.16 |
| .docx | 1 | 1 | 100.00% | 761.00 | 0.49 |
| .pdf | 40 | 40 | 100.00% | 1132.00 | 0.65 |
| .doc | 1 | 1 | 100.00% | 54.00 | 1.08 |

## Top 10 Slowest Parses

| File | Size KB | Duration ms |
|---|---|---|
| MBL_009_TM_MBL_3.0-04. Traceability Matrix.xlsx | 980 | 7917 |
| 73449666f86bf4e1.pdf | 10854 | 5863 |
| MBL_003_URS_A01_MBL_4.9-02.A01 Security Matrix.xlsx | 813 | 5545 |
| 92bbffb84fa32a7c.pdf | 771 | 3916 |
| ee2c3a4f3a1f2226.pdf | 363 | 3521 |
| e69dea192db88f46.pdf | 1285 | 3320 |
| a42c8ed0f1548653.pdf | 751 | 3286 |
| df88979e1567cfdc.pdf | 521 | 2692 |
| 7d11426351a574c9.pdf | 5808 | 2676 |
| ceff0881adf4f7b4.pdf | 603 | 2306 |

## Failures (0)

None.

## Warnings

- (1) mammoth: An unrecognised element was ignored: v:stroke
- (1) Failed to parse: Could not find the body element: are you sure this is a docx file?

## Empty-Result Suspects (success, size>100KB, text<100 chars)

None.

## Big Successes (>10MB)

- 73449666f86bf4e1.pdf (10.6MB, 5863ms, textLen=268621)
